"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuestInvitation } from "@/modules/invitations/validation";
import { ceremonyTiming } from "@/modules/events/validation";
import {
  responseLabel,
  responseTime,
  type RsvpResponse,
} from "@/modules/rsvp/validation";
import styles from "./rsvp.module.css";
type Ceremony = GuestInvitation["events"][number];
function CeremonyResponse({
  event,
  limit,
}: {
  event: Ceremony;
  limit: number;
}) {
  const row = event.invitation!,
    router = useRouter(),
    inFlight = useRef(false);
  const [saved, setSaved] = useState(row),
    [choice, setChoice] = useState<"attending" | "notAttending" | "">(
      row.status === "pending" ? "" : row.status,
    ),
    [count, setCount] = useState(
      row.status === "attending" ? String(row.attendingCount) : "",
    ),
    [max, setMax] = useState(limit),
    [editing, setEditing] = useState(row.status === "pending"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false),
    [blocked, setBlocked] = useState(false),
    [message, setMessage] = useState("");
  const dirty =
    choice !== (saved.status === "pending" ? "" : saved.status) ||
    (choice === "attending" && Number(count) !== saved.attendingCount);
  function reset() {
    setChoice(saved.status === "pending" ? "" : saved.status);
    setCount(saved.status === "attending" ? String(saved.attendingCount) : "");
    setEditing(saved.status === "pending");
    setError("");
    setMessage("");
  }
  async function latest() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/guest/invitation", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ||
            "Could not load your invitation. Please retry.",
        );
      const invitation = result.data as GuestInvitation;
      const current = invitation.events.find(
        (e) => e.invitation?.id === row.id,
      )?.invitation;
      if (!current) {
        setBlocked(true);
        throw new Error(
          "This ceremony is no longer available. Refresh the invitation or contact the couple.",
        );
      }
      setSaved(current);
      setChoice(current.status === "pending" ? "" : current.status);
      setCount(
        current.status === "attending" ? String(current.attendingCount) : "",
      );
      setMax(invitation.family.invitedCount);
      setConflict(false);
      setEditing(current.status === "pending");
      setMessage("Latest saved response loaded.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load the latest response.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (inFlight.current || blocked || conflict) return;
    setError("");
    setMessage("");
    if (!choice) {
      setError("Choose Attending or Not attending.");
      return;
    }
    const number = choice === "attending" ? Number(count) : 0;
    if (
      choice === "attending" &&
      (!count.trim() ||
        !Number.isSafeInteger(number) ||
        number < 1 ||
        number > max)
    ) {
      setError(`Enter a whole number between 1 and ${max}.`);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/guest/rsvp/" + saved.id, {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: saved.version,
          status: choice,
          attendingCount: number,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (
          response.status === 409 ||
          result.error?.code === "ATTENDING_COUNT_EXCEEDED"
        )
          setConflict(true);
        if (response.status === 401 || response.status === 404)
          setBlocked(true);
        throw new Error(
          result.error?.message ||
            "Could not save your response. Please retry.",
        );
      }
      const updated = result.data as RsvpResponse;
      setSaved({
        id: updated.invitationId,
        status: updated.status,
        attendingCount: updated.attendingCount,
        version: updated.version,
        respondedAt: updated.respondedAt,
      });
      setEditing(false);
      setMessage("Response saved.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save your response. Please retry.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <article
      className={styles.ceremony}
      aria-labelledby={"ceremony-" + event.id}
      aria-busy={busy}
    >
      <div className={styles.heading}>
        <h3 id={"ceremony-" + event.id}>{event.name}</h3>
        <span className={styles.badge} data-status={saved.status}>
          {responseLabel(saved.status)}
          {saved.status === "attending" ? ` · ${saved.attendingCount}` : ""}
        </span>
      </div>
      <p>{ceremonyTiming(event.startsAt)}</p>
      <p>{event.venue}</p>
      {!editing ? (
        <div className={styles.saved}>
          <p>
            {saved.status === "attending"
              ? `Response saved: ${saved.attendingCount} members attending.`
              : "Response saved: Not attending (0 members)."}
            <small>{responseTime(saved.respondedAt)}</small>
          </p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setEditing(true);
              setMessage("");
            }}
          >
            Edit response
          </button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset
            disabled={busy || blocked || conflict}
            className={styles.options}
          >
            <legend>Will your family attend {event.name}?</legend>
            <label>
              <input
                type="radio"
                name={row.id}
                value="attending"
                checked={choice === "attending"}
                onChange={() => setChoice("attending")}
              />{" "}
              Attending
            </label>
            <label>
              <input
                type="radio"
                name={row.id}
                value="notAttending"
                checked={choice === "notAttending"}
                onChange={() => setChoice("notAttending")}
              />{" "}
              Not attending
            </label>
          </fieldset>
          {choice === "attending" && (
            <div className={styles.counter}>
              <label htmlFor={"count-" + row.id}>
                Family members attending
              </label>
              <div className={styles.stepper}>
                <button
                  type="button"
                  aria-label={"Decrease attending members for " + event.name}
                  disabled={busy || blocked || conflict || Number(count) <= 1}
                  onClick={() =>
                    setCount(String(Math.max(1, (Number(count) || 1) - 1)))
                  }
                >
                  −
                </button>
                <input
                  id={"count-" + row.id}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={max}
                  step={1}
                  value={count}
                  onChange={(event) => setCount(event.target.value)}
                  disabled={busy || blocked || conflict}
                  aria-describedby={"limit-" + row.id}
                />
                <button
                  type="button"
                  aria-label={"Increase attending members for " + event.name}
                  disabled={busy || blocked || conflict || Number(count) >= max}
                  onClick={() =>
                    setCount(String(Math.min(max, (Number(count) || 0) + 1)))
                  }
                >
                  +
                </button>
              </div>
              <small id={"limit-" + row.id}>
                You can confirm up to {max} members.
              </small>
            </div>
          )}
          {dirty && <p className={styles.note}>You have unsaved changes.</p>}
          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={busy || blocked || conflict}
            >
              {busy
                ? "Saving…"
                : error
                  ? "Retry saving response"
                  : "Save response"}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={reset}
            >
              Cancel changes
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {conflict && (
        <button
          type="button"
          className={styles.secondary}
          disabled={busy}
          onClick={() => {
            if (
              !dirty ||
              window.confirm(
                "Load the latest saved response and discard your unsaved changes?",
              )
            )
              void latest();
          }}
        >
          Load latest response
        </button>
      )}
      {blocked && (
        <>
          <p>Reopen your latest invitation link, or contact the couple.</p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => router.refresh()}
          >
            Refresh invitation
          </button>
        </>
      )}
    </article>
  );
}
export function GuestRsvp({ invitation }: { invitation: GuestInvitation }) {
  return (
    <section className={styles.section} aria-labelledby="attendance-title">
      <div className={styles.intro}>
        <h2 id="attendance-title">Your attendance</h2>
        <p>
          Please respond for each ceremony. You can update your answers anytime.
        </p>
        <p className={styles.note}>
          Accepting the invitation and confirming ceremony attendance are
          separate.
        </p>
      </div>
      {invitation.events.length ? (
        invitation.events.map((event) =>
          event.invitation ? (
            <CeremonyResponse
              key={`${event.invitation.id}:${event.invitation.version}:${invitation.family.invitedCount}`}
              event={event}
              limit={invitation.family.invitedCount}
            />
          ) : null,
        )
      ) : (
        <p>
          No ceremonies are currently available. Please contact the couple for
          an update.
        </p>
      )}
      <p className={styles.note}>
        Your responses are shared with the couple. No guest account is required.
      </p>
    </section>
  );
}
