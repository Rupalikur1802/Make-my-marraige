"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FamilyDTO } from "@/modules/families/validation";
import { Confirm } from "./confirm";
import styles from "./families.module.css";
export function DeleteFamily({
  family,
  disabled = false,
  unsaved = false,
}: {
  family: FamilyDTO;
  disabled?: boolean;
  unsaved?: boolean;
}) {
  const router = useRouter(),
    inFlight = useRef(false);
  const [open, setOpen] = useState(false),
    [snapshot, setSnapshot] = useState(family),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false),
    [missing, setMissing] = useState(false),
    [expired, setExpired] = useState(false),
    [message, setMessage] = useState("");
  function start() {
    setSnapshot(family);
    setError("");
    setMessage("");
    setConflict(false);
    setMissing(false);
    setExpired(false);
    setOpen(true);
  }
  async function act() {
    if (inFlight.current || expired) return;
    if (missing) {
      setOpen(false);
      router.replace("/families");
      router.refresh();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/families/" +
          snapshot.id +
          (conflict ? "" : "?expectedRevision=" + snapshot.revision),
        { method: conflict ? "GET" : "DELETE", cache: "no-store" },
      );
      if (response.status === 204) {
        setOpen(false);
        router.replace("/families?deleted=1");
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
        setError("This family was already deleted or is no longer available.");
        return;
      }
      const body = await response.json();
      if (response.ok && conflict) {
        setSnapshot(body.data);
        setConflict(false);
        setMessage(
          "Latest saved details loaded. Review them before confirming deletion again.",
        );
        return;
      }
      if (response.status === 409) setConflict(true);
      setError(
        body.error?.message || "Could not delete this family. Please retry.",
      );
    } catch {
      setError(
        "We could not confirm deletion. Retry or return to the list to check whether the family still exists.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className={styles.textDanger}
        disabled={disabled}
        aria-label={"Delete " + family.name}
        onClick={start}
      >
        Delete
      </button>
      {open && (
        <Confirm
          title="Delete this family?"
          cancelLabel="Keep family"
          busy={busy}
          confirmDisabled={expired}
          danger={!conflict && !missing}
          confirmLabel={
            missing
              ? "Return to list"
              : conflict
                ? "Load latest details"
                : "Delete family"
          }
          onCancel={() => setOpen(false)}
          onConfirm={act}
        >
          <p>
            <strong>{snapshot.name}</strong> · {snapshot.invitedCount} invited
            members
          </p>
          <p>
            This permanently removes the family and its ceremony assignments,
            including any saved responses. Any existing invitation link and
            guest access will stop working. Other families and ceremonies remain
            unchanged.
          </p>
          {unsaved && <p>Unsaved edits on this page will also be discarded.</p>}
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
        </Confirm>
      )}
    </>
  );
}
