"use client";
import Link from "next/link";
import { DeleteCeremony } from "../delete-ceremony";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { EventDTO } from "@/modules/events/validation";
import { istInputs, istInstant } from "@/modules/events/validation";
import styles from "../ceremonies.module.css";
type Values = { name: string; date: string; time: string; venue: string };
function toValues(event: EventDTO): Values {
  return {
    name: event.name,
    ...istInputs(event.startsAt),
    venue: event.venue ?? "",
  };
}
export function CeremonyEditor({ initial }: { initial: EventDTO }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(toValues(initial));
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Partial<Values>>({});
  const [conflict, setConflict] = useState(false);
  const [expired, setExpired] = useState(false);
  const [missing, setMissing] = useState(false);
  const [confirmDraft, setConfirmDraft] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(toValues(saved));
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const leave = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a[href]");
      const logout =
        event.target.closest("button")?.textContent?.trim() === "Sign out";
      if (
        anchor instanceof HTMLAnchorElement &&
        new URL(anchor.href).pathname === window.location.pathname
      )
        return;
      if (
        (anchor || logout) &&
        !window.confirm(
          "Leave this page? Your unsaved ceremony changes will be lost.",
        )
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty]);
  useEffect(() => {
    if (confirmDraft) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmDraft]);
  function announce() {
    requestAnimationFrame(() => status.current?.focus());
  }
  async function reload() {
    if (inFlight.current) return;
    if (
      !window.confirm(
        "Load the latest saved details? This replaces any unsaved edits on this page.",
      )
    )
      return;
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/events/" + saved.id, {
        cache: "no-store",
      });
      if (response.status === 401) {
        setExpired(true);
        setError("Your session expired. Sign in again to continue.");
        return;
      }
      if (response.status === 404) {
        setMissing(true);
        setError(
          "This ceremony was already deleted or is no longer available.",
        );
        return;
      }
      if (!response.ok) throw new Error();
      const body = await response.json();
      setSaved(body.data);
      setValues(toValues(body.data));
      setFields({});
      setConflict(false);
      setError("");
      setMessage("Latest saved ceremony loaded.");
    } catch {
      setError(
        "Could not load the latest details. Your edits remain on this page.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
      announce();
    }
  }
  async function save(target: "draft" | "published", moveOnly = false) {
    if (inFlight.current || conflict || expired || missing) return;
    setError("");
    setMessage("");
    setFields({});
    const errors: Partial<Values> = {};
    const name = values.name.trim(),
      venue = values.venue.trim();
    let startsAt: string | null = null;
    if (!moveOnly) {
      if (!name) errors.name = "Enter a ceremony name.";
      if (values.date || values.time) {
        startsAt = istInstant(values.date, values.time);
        if (!startsAt) {
          if (!values.date) errors.date = "Choose a valid date.";
          if (!values.time) errors.time = "Choose a valid time.";
          if (values.date && values.time)
            errors.date = "Choose a valid calendar date and time.";
        }
      }
      if (target === "published") {
        if (!values.date) errors.date = "Date is required to publish.";
        if (!values.time) errors.time = "Time is required to publish.";
        if (!venue) errors.venue = "Venue and address are required to publish.";
      }
      if (Object.keys(errors).length) {
        setFields(errors);
        setError("Check the highlighted ceremony details.");
        announce();
        return;
      }
      const previous = istInputs(saved.startsAt);
      if (values.date === previous.date && values.time === previous.time)
        startsAt = saved.startsAt;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/events/" + saved.id, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          moveOnly
            ? { expectedVersion: saved.version, status: "draft" }
            : {
                expectedVersion: saved.version,
                name,
                status: target,
                startsAt,
                venue: venue || null,
              },
        ),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 404) {
          setMissing(true);
          setError(
            "This ceremony was already deleted or is no longer available.",
          );
        } else if (response.status === 401) {
          setExpired(true);
          setError(
            "Your session expired. Your edits remain on this page. Sign in again to continue.",
          );
        } else if (
          response.status === 409 &&
          body.error?.code === "VERSION_CONFLICT"
        ) {
          setConflict(true);
          setError(
            "Your partner or another device updated this ceremony. Load the latest details before saving again.",
          );
        } else {
          setError(
            body.error?.message ||
              "We couldn’t save this ceremony. Please retry.",
          );
          const serverFields = body.error?.fields ?? {};
          setFields({
            name: serverFields.name,
            venue: serverFields.venue,
            date: serverFields.startsAt,
          });
        }
        return;
      }
      setSaved(body.data);
      setValues(toValues(body.data));
      setFields({});
      router.refresh();
      setMessage(
        moveOnly
          ? "Ceremony moved to draft. Saved details are preserved."
          : target === "published"
            ? saved.status === "published"
              ? "Published ceremony updated."
              : "Ceremony published. No invitations were sent."
            : "Draft saved successfully.",
      );
    } catch {
      setError(
        "We couldn’t save this ceremony. Your edits remain on this page; check your connection and retry.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
      setConfirmDraft(false);
      announce();
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(saved.status);
  }
  return (
    <>
      <Link className={styles.back} href="/ceremonies">
        ← Back to ceremonies
      </Link>
      <div className={styles.editorHeading}>
        <p className={styles.couple}>
          {saved.presetKey
            ? "Preset: " + saved.presetKey + " · Identifier locked"
            : "Custom ceremony"}
        </p>
        <h1>Edit {saved.name}</h1>
        <p className={styles.lead}>
          Save partial plans as a draft, or publish when the name, timing and
          venue are complete.
        </p>
      </div>
      <div className={styles.editorGrid}>
        <form
          className={styles.form}
          onSubmit={submit}
          noValidate
          aria-busy={busy}
        >
          <div ref={status} tabIndex={-1} className={styles.feedback}>
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
            {expired && <Link href="/login">Sign in again</Link>}
            {missing && <Link href="/ceremonies">Back to ceremonies</Link>}
            {conflict && (
              <>
                <p>
                  Loading the latest details replaces unsaved edits. Nothing
                  will be overwritten automatically.
                </p>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={reload}
                  disabled={busy}
                >
                  Load latest details
                </button>
              </>
            )}
          </div>
          <fieldset disabled={busy || conflict || expired || missing}>
            <div className={styles.field}>
              <label htmlFor="ceremony-name">
                Ceremony name <span>*</span>
              </label>
              <input
                id="ceremony-name"
                name="name"
                value={values.name}
                maxLength={100}
                required
                onChange={(event) =>
                  setValues({ ...values, name: event.target.value })
                }
                aria-invalid={!!fields.name}
                aria-describedby={fields.name ? "name-error" : "name-hint"}
              />
              <div className={styles.hintRow}>
                <p id="name-hint">A name for this celebration.</p>
                <span>{values.name.length} / 100</span>
              </div>
              {fields.name && (
                <p className={styles.fieldError} id="name-error">
                  {fields.name}
                </p>
              )}
            </div>
            <div className={styles.dateRow}>
              {(["date", "time"] as const).map((key) => (
                <div className={styles.field} key={key}>
                  <label htmlFor={"ceremony-" + key}>
                    {key === "date" ? "Date" : "Time (IST)"}
                  </label>
                  <input
                    id={"ceremony-" + key}
                    name={key}
                    type={key}
                    step={key === "time" ? 60 : undefined}
                    value={values[key]}
                    onChange={(event) =>
                      setValues({ ...values, [key]: event.target.value })
                    }
                    aria-invalid={!!fields[key]}
                    aria-describedby={
                      fields[key] ? key + "-error" : "timing-hint"
                    }
                  />
                  {fields[key] && (
                    <p className={styles.fieldError} id={key + "-error"}>
                      {fields[key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p id="timing-hint" className={styles.hint}>
              Asia/Kolkata (UTC +05:30). Date and time are saved together; leave
              both empty to save an untimed draft.
            </p>
            <div className={styles.field}>
              <label htmlFor="ceremony-venue">
                Venue &amp; address{" "}
                <span className={styles.optional}>Required to publish</span>
              </label>
              <textarea
                id="ceremony-venue"
                name="venue"
                rows={5}
                maxLength={500}
                value={values.venue}
                onChange={(event) =>
                  setValues({ ...values, venue: event.target.value })
                }
                placeholder="Venue name and full address"
                aria-invalid={!!fields.venue}
                aria-describedby={fields.venue ? "venue-error" : undefined}
              />
              <div className={styles.hintRow}>
                <p>Enter the location guests will need.</p>
                <span>{values.venue.length} / 500</span>
              </div>
              {fields.venue && (
                <p className={styles.fieldError} id="venue-error">
                  {fields.venue}
                </p>
              )}
            </div>
          </fieldset>
          <div className={styles.actions}>
            {saved.status === "draft" ? (
              <>
                <button
                  type="submit"
                  className={styles.secondary}
                  disabled={busy || conflict || expired || missing}
                >
                  {busy ? "Saving…" : "Save draft"}
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => void save("published")}
                  disabled={busy || conflict || expired || missing}
                >
                  Publish ceremony
                </button>
              </>
            ) : (
              <>
                <button
                  type="submit"
                  className={styles.primary}
                  disabled={busy || conflict || expired || missing}
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setConfirmDraft(true)}
                  disabled={busy || conflict || expired || missing}
                >
                  Move to draft
                </button>
              </>
            )}
            <Link href="/ceremonies">Cancel and exit</Link>
          </div>
        </form>
        <aside className={styles.editorAside}>
          <span
            className={
              saved.status === "published" ? styles.published : styles.draft
            }
          >
            {saved.status}
          </span>
          <h2>A deliberate next step.</h2>
          <p>
            Publishing marks this ceremony ready for future guest invitations.
            It does not send invitations.
          </p>
          <p>
            Moving it to draft preserves its saved details and makes it
            unavailable through future guest invitations.
          </p>
          <dl>
            <dt>Last saved</dt>
            <dd>
              {new Intl.DateTimeFormat("en-IN", {
                timeZone: "Asia/Kolkata",
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(saved.updatedAt))}{" "}
              IST
            </dd>
          </dl>
        </aside>
      </div>
      <section className={styles.deleteSection}>
        <h2>Delete ceremony</h2>
        <p>
          Permanently remove this ceremony after reviewing the consequences.
        </p>
        <DeleteCeremony
          event={saved}
          unsaved={dirty}
          disabled={busy || conflict || expired || missing}
        />
      </section>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="draft-title"
        aria-describedby="draft-description"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setConfirmDraft(false);
        }}
      >
        <h2 id="draft-title">Move ceremony to draft?</h2>
        <p id="draft-description">
          This will make “{saved.name}” unavailable through future guest
          invitations. Its saved name, date, time and venue will be preserved.
        </p>
        {dirty && <p>Unsaved edits on this page will be discarded.</p>}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={() => void save("draft", true)}
          >
            {busy ? "Saving…" : "Confirm move to draft"}
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            autoFocus
            onClick={() => setConfirmDraft(false)}
          >
            Keep published
          </button>
        </div>
      </dialog>
    </>
  );
}
