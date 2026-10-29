"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ceremonyTiming, type EventDTO } from "@/modules/events/validation";
import styles from "./ceremonies.module.css";
export function DeleteCeremony({
  event,
  onDeleted,
  unsaved = false,
  disabled = false,
}: {
  event: EventDTO;
  onDeleted?: () => void;
  unsaved?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false),
    [expired, setExpired] = useState(false),
    [missing, setMissing] = useState(false);
  const [snapshot, setSnapshot] = useState(event);
  const dialog = useRef<HTMLDialogElement>(null),
    inFlight = useRef(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  function start() {
    setSnapshot(event);
    setError("");
    setMessage("");
    setConflict(false);
    setExpired(false);
    setMissing(false);
    setOpen(true);
  }
  async function latest() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/events/" + snapshot.id, {
        cache: "no-store",
      });
      if (response.status === 401) {
        setExpired(true);
        setError("Your session expired. Sign in again.");
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
      setSnapshot(body.data);
      setConflict(false);
      setError("");
      setMessage(
        "Latest saved details loaded. Review them before confirming deletion.",
      );
    } catch {
      setError("Could not load the latest details. Please retry.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (inFlight.current || conflict || expired || missing) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        "/api/events/" + snapshot.id + "?expectedVersion=" + snapshot.version,
        { method: "DELETE", cache: "no-store" },
      );
      if (response.status === 204) {
        setOpen(false);
        if (onDeleted) onDeleted();
        else router.replace("/ceremonies?deleted=1");
        router.refresh();
        return;
      }
      if (response.status === 401) {
        setExpired(true);
        setError("Your session expired. Sign in again.");
        return;
      }
      if (response.status === 404) {
        setMissing(true);
        setError(
          "This ceremony was already deleted or is no longer available.",
        );
        return;
      }
      const body = await response.json();
      if (response.status === 409) {
        setConflict(true);
        setError(
          "Your partner or another device changed this ceremony. Load the latest details before trying again.",
        );
      } else
        setError(
          body.error?.message ||
            "Deletion failed. The ceremony has not been removed; please retry.",
        );
    } catch {
      setError(
        "We couldn’t confirm deletion. Check your connection and retry, or reload to check whether the ceremony still exists.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function finishMissing() {
    setOpen(false);
    if (onDeleted) onDeleted();
    else router.replace("/ceremonies");
    router.refresh();
  }
  return (
    <>
      <button
        className={styles.deleteAction}
        type="button"
        disabled={disabled}
        onClick={start}
        aria-label={"Delete " + event.name}
      >
        Delete
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={"delete-title-" + event.id}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setOpen(false);
        }}
      >
        <h2 id={"delete-title-" + event.id}>Delete “{snapshot.name}”?</h2>
        <p>This ceremony will be permanently deleted. This cannot be undone.</p>
        <ul className={styles.consequences}>
          <li>
            Any family assignments and RSVP responses for this ceremony will be
            removed.
          </li>
          <li>
            Linked tasks and expenses will be kept, but their ceremony
            association will be cleared.
          </li>
          <li>
            Other ceremonies remain unchanged. Deletion does not send
            notifications.
          </li>
        </ul>
        {snapshot.status === "published" && (
          <p className={styles.notice}>
            This published ceremony will no longer be available through guest
            invitations.
          </p>
        )}
        <div className={styles.deleteReview}>
          <strong>{snapshot.name}</strong>
          <span>{ceremonyTiming(snapshot.startsAt)}</span>
          <span>{snapshot.venue || "Venue: Not configured"}</span>
          <span>{snapshot.status}</span>
        </div>
        {unsaved && (
          <p>
            Deleting this ceremony also discards unsaved edits on this page.
          </p>
        )}
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
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            type="button"
            autoFocus
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Keep ceremony
          </button>
          {missing ? (
            <button
              className={styles.secondary}
              type="button"
              onClick={finishMissing}
            >
              Return to updated list
            </button>
          ) : conflict ? (
            <button
              className={styles.secondary}
              type="button"
              onClick={latest}
              disabled={busy}
            >
              {busy ? "Loading…" : "Load latest details"}
            </button>
          ) : (
            <button
              className={styles.danger}
              type="button"
              disabled={busy || expired}
              onClick={remove}
            >
              {busy ? "Deleting…" : "Delete ceremony"}
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
