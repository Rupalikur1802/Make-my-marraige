"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  familyCreateSchema,
  familyPatchSchema,
  type FamilyDetail,
} from "@/modules/families/validation";
import { ceremonyTiming, type EventDTO } from "@/modules/events/validation";
import { Confirm } from "./confirm";
import { DeleteFamily } from "./delete-family";
import styles from "./families.module.css";
function valuesOf(f?: FamilyDetail) {
  return {
    name: f?.name ?? "",
    email: f?.email ?? "",
    invitedCount: f ? String(f.invitedCount) : "",
  };
}
function equalIds(a: string[], b: string[]) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}
export function FamilyEditor({
  initial,
  initialEvents,
}: {
  initial?: FamilyDetail;
  initialEvents: EventDTO[];
}) {
  const router = useRouter(),
    inFlight = useRef(false);
  const [saved, setSaved] = useState(initial),
    [values, setValues] = useState(valuesOf(initial)),
    [events, setEvents] = useState(initialEvents),
    [selected, setSelected] = useState(
      initial?.eventAssignments.map((r) => r.eventId) ?? [],
    );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [conflict, setConflict] = useState(false),
    [missing, setMissing] = useState(false),
    [expired, setExpired] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [confirm, setConfirm] = useState<"assignments" | "reload" | null>(null);
  const savedIds = saved?.eventAssignments.map((r) => r.eventId) ?? [];
  const detailsDirty =
    JSON.stringify(values) !== JSON.stringify(valuesOf(saved));
  const assignmentsDirty = !equalIds(selected, savedIds);
  const dirty = detailsDirty || assignmentsDirty;
  const blocked = busy || conflict || missing || expired || uncertain;
  const removed =
    saved?.eventAssignments.filter((r) => !selected.includes(r.eventId)) ?? [];
  useEffect(() => {
    if (!dirty || missing) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const leave = (e: MouseEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest("a[href]") &&
        !window.confirm(
          "Leave this page? Your unsaved family changes will be lost.",
        )
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty, missing]);
  async function handleFailure(response: Response) {
    if (response.status === 401) {
      setExpired(true);
      setError(
        "Your session expired. Your entries remain here; sign in again to continue.",
      );
      return;
    }
    if (response.status === 404) {
      setMissing(true);
      setError("This family was deleted or is no longer available.");
      return;
    }
    const body = await response.json();
    setError(
      body.error?.message || "Could not save your changes. Please retry.",
    );
    setFields(body.error?.fields ?? {});
    if (response.status === 409) {
      if (
        body.error?.code === "VERSION_CONFLICT" ||
        body.error?.code === "EVENT_UNAVAILABLE"
      )
        setConflict(true);
      if (body.error?.code === "RESPONSE_REMOVAL_CONFIRMATION_REQUIRED")
        setConfirm("assignments");
    }
  }
  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || blocked) return;
    const payload = {
      ...values,
      invitedCount: Number(values.invitedCount),
      ...(saved
        ? { expectedRevision: saved.revision }
        : { eventIds: selected }),
    };
    const validation = saved
      ? familyPatchSchema.safeParse(payload)
      : familyCreateSchema.safeParse(payload);
    setError("");
    setMessage("");
    setFields({});
    if (!validation.success) {
      const errors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") errors[key] = issue.message;
      }
      setFields(errors);
      setError("Please check the highlighted details.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch(
        "/api/families" + (saved ? "/" + saved.id : ""),
        {
          method: saved ? "PATCH" : "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validation.data),
        },
      );
      if (!response.ok) {
        await handleFailure(response);
        return;
      }
      const body = await response.json();
      const next = body.data as FamilyDetail;
      setSaved(next);
      setValues(valuesOf(next));
      if (!saved) {
        setSelected(next.eventAssignments.map((r) => r.eventId));
        router.replace("/families/" + next.id);
      }
      setMessage(
        saved
          ? "Family details saved. Ceremony selections are saved separately below."
          : "Family and ceremony assignments saved. No invitation was sent.",
      );
      router.refresh();
    } catch {
      setError(
        saved
          ? "We could not confirm the save. Your entries remain here. Load latest details before retrying."
          : "We could not confirm creation. Check the family list before adding again to avoid a duplicate.",
      );
      if (saved) setConflict(true);
      else setUncertain(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function saveAssignments(confirmed = false) {
    if (!saved || inFlight.current || blocked) return;
    if (removed.length && !confirmed) {
      setConfirm("assignments");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/families/" + saved.id + "/events", {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: saved.revision,
          eventIds: selected,
          confirmResponseRemoval: confirmed,
        }),
      });
      if (!response.ok) {
        await handleFailure(response);
        return;
      }
      const next = (await response.json()).data as FamilyDetail;
      setSaved(next);
      setSelected(next.eventAssignments.map((r) => r.eventId));
      setConfirm(null);
      setMessage(
        "Ceremony assignments saved. Retained assignments and responses were preserved.",
      );
      router.refresh();
    } catch {
      setError(
        "We could not confirm the assignment save. Load latest details before retrying.",
      );
      setConflict(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function reload() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const eventResponse = await fetch("/api/events", { cache: "no-store" });
      if (!eventResponse.ok) {
        await handleFailure(eventResponse);
        return;
      }
      let latest = saved;
      if (saved) {
        const response = await fetch("/api/families/" + saved.id, {
          cache: "no-store",
        });
        if (!response.ok) {
          await handleFailure(response);
          return;
        }
        latest = (await response.json()).data;
      }
      setEvents((await eventResponse.json()).data);
      setSaved(latest);
      setValues(valuesOf(latest));
      setSelected(latest?.eventAssignments.map((r) => r.eventId) ?? []);
      setConflict(false);
      setFields({});
      setConfirm(null);
      setMessage(
        "Latest saved details and ceremonies loaded. Review before saving again.",
      );
    } catch {
      setError("Unable to load latest details. Please retry.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={styles.editor}>
      <p className={styles.eyebrow}>Household records</p>
      <h1>{saved ? "Edit family" : "Add family"}</h1>
      <p>
        Save household details and choose the ceremonies this family is invited
        to.
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className={styles.success}>
          {message}
        </p>
      )}
      {dirty && <p className={styles.muted}>You have unsaved changes.</p>}
      {expired && <Link href="/login">Sign in again</Link>}
      {missing && <Link href="/families">Return to families</Link>}
      {uncertain && <Link href="/families">Check saved families</Link>}
      {conflict && (
        <button
          className={styles.secondary}
          disabled={busy}
          type="button"
          onClick={() => setConfirm("reload")}
        >
          Load latest details
        </button>
      )}
      <form
        onSubmit={saveDetails}
        noValidate
        className={styles.panel}
        aria-busy={busy}
      >
        <h2>Family details</h2>
        <fieldset className={styles.fieldset} disabled={blocked}>
          <div className={styles.field}>
            <label htmlFor="family-name">Family name *</label>
            <input
              id="family-name"
              value={values.name}
              maxLength={150}
              required
              autoComplete="off"
              aria-invalid={!!fields.name}
              aria-describedby="family-name-error"
              onChange={(e) => setValues({ ...values, name: e.target.value })}
            />
            <small>{values.name.length}/150 characters</small>
            <span id="family-name-error" className={styles.fieldError}>
              {fields.name}
            </span>
          </div>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="family-email">Invitation email (optional)</label>
              <input
                id="family-email"
                type="email"
                autoComplete="email"
                placeholder="sharma@example.test"
                value={values.email}
                maxLength={254}
                aria-invalid={!!fields.email}
                aria-describedby="family-email-help family-email-error"
                onChange={(e) =>
                  setValues({ ...values, email: e.target.value })
                }
              />
              <small id="family-email-help">
                Used when you choose to send an invitation. Saving an address
                does not send an email.
              </small>
              <span id="family-email-error" className={styles.fieldError}>
                {fields.email}
              </span>
            </div>
            <div className={styles.field}>
              <label htmlFor="family-count">Invited members *</label>
              <input
                id="family-count"
                type="number"
                min="1"
                step="1"
                value={values.invitedCount}
                required
                aria-invalid={!!fields.invitedCount}
                aria-describedby="family-count-help family-count-error"
                onChange={(e) =>
                  setValues({ ...values, invitedCount: e.target.value })
                }
              />
              <small id="family-count-help">
                The maximum members this family can RSVP for at each assigned
                ceremony.
              </small>
              <span id="family-count-error" className={styles.fieldError}>
                {fields.invitedCount}
              </span>
            </div>
          </div>
          {!saved && (
            <CeremonyChoices
              events={events}
              selected={selected}
              onChange={setSelected}
              error={fields.eventIds}
            />
          )}
          <p className={styles.notice}>
            Saving this family does not send an invitation.
          </p>
          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={!!saved && !detailsDirty}
            >
              {busy ? "Saving…" : saved ? "Save details" : "Save family"}
            </button>
            <Link href="/families">
              {saved ? "Back to families" : "Cancel"}
            </Link>
          </div>
        </fieldset>
      </form>
      {saved && (
        <section className={styles.panel}>
          <h2>Ceremony assignments</h2>
          <p className={styles.muted}>Saved separately from family details.</p>
          <fieldset className={styles.fieldset} disabled={blocked}>
            <CeremonyChoices
              events={events}
              selected={selected}
              onChange={setSelected}
              error={fields.eventIds}
            />
            <div className={styles.actions}>
              <button
                className={styles.primary}
                type="button"
                disabled={!assignmentsDirty}
                onClick={() => void saveAssignments()}
              >
                {busy ? "Saving…" : "Save ceremony assignments"}
              </button>
            </div>
          </fieldset>
        </section>
      )}
      {saved && (
        <section className={styles.panel}>
          <h2>Invite this family</h2>
          <p>
            <Link href={"/families/" + saved.id + "/invitation"}>
              Manage invitation link and email →
            </Link>
          </p>
        </section>
      )}
      {saved && (
        <section className={styles.panel}>
          <h2>Remove family</h2>
          <p>
            Permanent removal also deletes its ceremony assignments and any
            saved responses.
          </p>
          <DeleteFamily family={saved} unsaved={dirty} disabled={blocked} />
        </section>
      )}
      {confirm === "reload" && (
        <Confirm
          title="Load latest saved details?"
          busy={busy}
          confirmLabel="Load latest details"
          onCancel={() => setConfirm(null)}
          onConfirm={() => void reload()}
        >
          <p>
            This replaces your unsaved family details and ceremony selections
            with the latest saved values.
          </p>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </Confirm>
      )}
      {confirm === "assignments" && (
        <Confirm
          title="Remove ceremony assignments?"
          busy={busy}
          confirmDisabled={conflict || expired || missing}
          danger
          confirmLabel="Remove and save assignments"
          onCancel={() => setConfirm(null)}
          onConfirm={() => void saveAssignments(true)}
        >
          <p>The following assignments will be removed:</p>
          <ul>
            {removed.map((r) => (
              <li key={r.eventId}>{r.eventName}</li>
            ))}
          </ul>
          <p>
            Any saved responses for these removed assignments will also be
            permanently deleted. Retained assignments and responses stay
            unchanged.
          </p>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </Confirm>
      )}
    </div>
  );
}
function CeremonyChoices({
  events,
  selected,
  onChange,
  error,
}: {
  events: EventDTO[];
  selected: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  return (
    <>
      <h2>Choose ceremonies</h2>
      <p className={styles.muted}>
        Optional. You can assign draft ceremonies now. Guests will only see
        assigned ceremonies after they are published.
      </p>
      {error && (
        <p role="alert" className={styles.fieldError}>
          {error}
        </p>
      )}
      <div
        className={styles.options}
        role="group"
        aria-label="Ceremony assignments"
      >
        {events.length ? (
          events.map((e) => (
            <label className={styles.option} key={e.id}>
              <input
                type="checkbox"
                checked={selected.includes(e.id)}
                onChange={(change) =>
                  onChange(
                    change.target.checked
                      ? [...selected, e.id]
                      : selected.filter((id) => id !== e.id),
                  )
                }
              />
              <span>
                <strong>{e.name}</strong>
                <small>
                  {e.status === "draft" ? "Draft" : "Published"} ·{" "}
                  {ceremonyTiming(e.startsAt)}
                </small>
              </span>
            </label>
          ))
        ) : (
          <p>
            No ceremonies are available. You can save this family without
            assignments.
          </p>
        )}
      </div>
    </>
  );
}
