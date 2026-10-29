"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/invite/invitation.module.css";
export function GuestActions({
  retryOnly = false,
  acceptedAt = null,
}: {
  retryOnly?: boolean;
  acceptedAt?: string | null;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState(acceptedAt);
  async function accept() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/guest/accept", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ||
            "Could not accept the invitation. Please retry.",
        );
      setAccepted(result.data.family.invitationAcceptedAt);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not accept the invitation. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function close() {
    setBusy(true);
    try {
      const response = await fetch("/api/guest/logout", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      router.replace("/invite");
      router.refresh();
    } catch {
      setError("Could not close this invitation. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {!retryOnly &&
        (accepted || acceptedAt ? (
          <p role="status">
            Invitation accepted. Thank you! The couple can now see your
            response.
          </p>
        ) : (
          <>
            <p>Let the couple know your family has accepted this invitation.</p>
            <button
              className={styles.button}
              disabled={busy}
              onClick={() => void accept()}
            >
              {busy ? "Saving…" : "Accept invitation"}
            </button>
          </>
        ))}
      <button
        className={styles.button}
        disabled={busy}
        onClick={() => router.refresh()}
      >
        Refresh invitation
      </button>
      {!retryOnly && (
        <button
          className={styles.button}
          disabled={busy}
          onClick={() => void close()}
        >
          Close invitation on this device
        </button>
      )}
    </>
  );
}
