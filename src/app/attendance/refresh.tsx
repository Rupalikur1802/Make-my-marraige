"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
export function RefreshAttendance() {
  const router = useRouter(),
    [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Refreshing…" : "Refresh responses"}
    </button>
  );
}
