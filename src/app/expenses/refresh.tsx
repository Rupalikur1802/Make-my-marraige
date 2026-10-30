"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./expenses.module.css";
export function RefreshExpenses() {
  const router = useRouter(),
    [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={styles.secondary}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Refreshing…" : "Refresh expenses"}
    </button>
  );
}
