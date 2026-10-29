"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/invite/invitation.module.css";
export function GuestActions({ retryOnly = false }: { retryOnly?: boolean }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
