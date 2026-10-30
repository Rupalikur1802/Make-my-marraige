"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AddCeremony } from "@/app/ceremonies/add-ceremony";
import styles from "./dashboard.module.css";
export function RefreshDashboard() {
  const router = useRouter(),
    [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={styles.refresh}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Refreshing…" : "↻ Refresh dashboard"}
    </button>
  );
}
export function DashboardActions() {
  const router = useRouter();
  return (
    <div className={styles.actions} aria-label="Quick actions">
      <Link href="/families/new">＋ Add family</Link>
      <AddCeremony onCreated={() => router.refresh()} />
      <Link href="/tasks?create=1">＋ Add task</Link>
      <Link href="/expenses?create=1">＋ Record expense</Link>
      <Link href="/attendance">View attendance →</Link>
      <Link href="/wedding/setup">Edit wedding details ↗</Link>
    </div>
  );
}
