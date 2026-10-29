"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./invitation.module.css";
export function InvitationEntry() {
  const router = useRouter(),
    token = useRef<string | null>(null),
    started = useRef(false),
    inFlight = useRef(false);
  const [canRetry, setCanRetry] = useState(false);
  const [busy, setBusy] = useState(true),
    [message, setMessage] = useState("");
  const open = useCallback(async () => {
    if (inFlight.current) return;
    if (!token.current) {
      setBusy(false);
      setMessage(
        "This invitation is unavailable. Please contact the couple for a current link.",
      );
      return;
    }
    inFlight.current = true;
    setCanRetry(true);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/guest/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.current }),
        cache: "no-store",
      });
      if (response.ok) {
        token.current = null;
        router.replace("/guest");
        router.refresh();
        return;
      }
      setMessage(
        response.status === 429
          ? "Too many invitation attempts. Please try again later."
          : response.status >= 500
            ? "We could not open your invitation. Check your connection and retry."
            : "This invitation is unavailable. Please contact the couple for a current link.",
      );
    } catch {
      setMessage(
        "We could not open your invitation. Check your connection and retry.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [router]);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const candidate = new URLSearchParams(window.location.hash.slice(1)).get(
      "token",
    );
    token.current =
      candidate && /^[A-Za-z0-9_-]{43}$/.test(candidate) ? candidate : null;
    window.history.replaceState(null, "", "/invite");
    void open();
  }, [open]);
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.brand}>Make My Marriage</p>
        <h1>{busy ? "Opening your invitation…" : "Your invitation"}</h1>
        {busy && (
          <p role="status">
            Please wait while we open your family’s private invitation.
          </p>
        )}
        {message && (
          <p role="alert" className={styles.error}>
            {message}
          </p>
        )}
        {!busy && canRetry && (
          <button className={styles.button} onClick={() => void open()}>
            Try again
          </button>
        )}
      </section>
    </main>
  );
}
