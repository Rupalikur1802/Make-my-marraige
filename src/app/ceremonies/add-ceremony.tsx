"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { istInstant, type EventDTO } from "@/modules/events/validation";
import styles from "./ceremonies.module.css";
const empty = { name: "", date: "", time: "", venue: "" };
export function AddCeremony({
  onCreated,
}: {
  onCreated: (event: EventDTO) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [values, setValues] = useState(empty),
    [error, setError] = useState(""),
    [expired, setExpired] = useState(false);
  const [fields, setFields] = useState<Partial<typeof empty>>({}),
    [created, setCreated] = useState<EventDTO | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    inFlight = useRef(false),
    attempt = useRef<{ payload: string; key: string } | null>(null);
  const dirty = !created && Object.values(values).some(Boolean);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (!open || !dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const leave = (event: MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest("a[href]")
      )
        return;
      if (
        !window.confirm(
          "Leave this page? Your unsaved ceremony draft will be lost.",
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
  }, [open, dirty]);
  function close() {
    if (busy) return;
    if (dirty && !window.confirm("Discard this unsaved ceremony draft?"))
      return;
    setOpen(false);
  }
  function start() {
    setValues(empty);
    setFields({});
    setCreated(null);
    setError("");
    setExpired(false);
    attempt.current = null;
    setOpen(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || expired) return;
    const errors: Partial<typeof empty> = {};
    if (!values.name.trim()) errors.name = "Enter a ceremony name.";
    const startsAt =
      values.date || values.time ? istInstant(values.date, values.time) : null;
    if ((values.date || values.time) && !startsAt) {
      errors.date =
        "Supply a valid date and time together, or leave both empty.";
      errors.time = "Date and time must both be provided.";
    }
    setFields(errors);
    setError("");
    if (Object.keys(errors).length) {
      setError("Please check the highlighted details.");
      return;
    }
    const payload = JSON.stringify({
      name: values.name.trim(),
      startsAt,
      venue: values.venue.trim() || null,
    });
    if (!attempt.current || attempt.current.payload !== payload)
      attempt.current = { payload, key: crypto.randomUUID() };
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attempt.current.key,
        },
        body: payload,
      });
      if (response.status === 401) {
        setExpired(true);
        setError(
          "Your session expired. Your entries remain here; sign in again to continue.",
        );
        return;
      }
      const body = await response.json();
      if (!response.ok) {
        setError(
          body.error?.message || "We couldn’t create this draft. Please retry.",
        );
        setFields({
          name: body.error?.fields?.name,
          date: body.error?.fields?.startsAt,
          venue: body.error?.fields?.venue,
        });
        return;
      }
      setCreated(body.data);
      onCreated(body.data);
      router.refresh();
    } catch {
      setError(
        "We couldn’t confirm creation. Your entries remain here; retrying the same details reuses the same creation attempt.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button className={styles.primary} type="button" onClick={start}>
        ＋ Add ceremony
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog + " " + styles.addDialog}
        aria-labelledby="add-ceremony-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <p className={styles.couple}>New celebration</p>
        <h2 id="add-ceremony-title">Add ceremony</h2>
        {created ? (
          <>
            <p role="status" className={styles.success}>
              “{created.name}” was saved as a draft.
            </p>
            <div className={styles.actions}>
              <Link
                className={styles.primary}
                href={"/ceremonies/" + created.id}
              >
                Edit saved ceremony →
              </Link>
              <button
                className={styles.secondary}
                type="button"
                onClick={close}
              >
                Back to ceremonies
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} noValidate aria-busy={busy}>
            <p>
              Create the draft now. You can publish it after reviewing the
              required details.
            </p>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            {expired && <Link href="/login">Sign in again</Link>}
            <fieldset disabled={busy || expired}>
              <div className={styles.field}>
                <label htmlFor="new-name">Ceremony name *</label>
                <input
                  id="new-name"
                  value={values.name}
                  maxLength={100}
                  required
                  onChange={(event) =>
                    setValues({ ...values, name: event.target.value })
                  }
                  aria-invalid={!!fields.name}
                  aria-describedby={fields.name ? "new-name-error" : undefined}
                />
                <span className={styles.hint}>{values.name.length} / 100</span>
                {fields.name && (
                  <p className={styles.fieldError} id="new-name-error">
                    {fields.name}
                  </p>
                )}
              </div>
              <div className={styles.dateRow}>
                {(["date", "time"] as const).map((key) => (
                  <div className={styles.field} key={key}>
                    <label htmlFor={"new-" + key}>
                      {key === "date" ? "Date" : "Time (IST)"}
                    </label>
                    <input
                      id={"new-" + key}
                      type={key}
                      value={values[key]}
                      onChange={(event) =>
                        setValues({ ...values, [key]: event.target.value })
                      }
                      aria-invalid={!!fields[key]}
                      aria-describedby={
                        fields[key]
                          ? "new-" + key + "-error"
                          : "new-timing-hint"
                      }
                    />
                    {fields[key] && (
                      <p
                        className={styles.fieldError}
                        id={"new-" + key + "-error"}
                      >
                        {fields[key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <p id="new-timing-hint" className={styles.hint}>
                Optional: enter both date and time, or leave both empty.
                Asia/Kolkata (IST, UTC +05:30).
              </p>
              <div className={styles.field}>
                <label htmlFor="new-venue">
                  Venue &amp; address (optional)
                </label>
                <textarea
                  id="new-venue"
                  rows={3}
                  maxLength={500}
                  value={values.venue}
                  onChange={(event) =>
                    setValues({ ...values, venue: event.target.value })
                  }
                  aria-invalid={!!fields.venue}
                  aria-describedby={
                    fields.venue ? "new-venue-error" : undefined
                  }
                />
                <span className={styles.hint}>{values.venue.length} / 500</span>
                {fields.venue && (
                  <p className={styles.fieldError} id="new-venue-error">
                    {fields.venue}
                  </p>
                )}
              </div>
            </fieldset>
            <div className={styles.actions}>
              <button
                className={styles.secondary}
                type="button"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
              <button
                className={styles.primary}
                type="submit"
                disabled={busy || expired}
              >
                {busy ? "Creating…" : "Create draft"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
