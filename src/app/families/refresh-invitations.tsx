"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./families.module.css";
export function RefreshInvitations() {
  const router = useRouter(),
    [pending, startTransition] = useTransition();
  return (
    <button
      className={styles.secondary}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Refreshing…" : "Refresh invitations"}
    </button>
  );
}
