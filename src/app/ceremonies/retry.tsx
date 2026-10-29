"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
export function RetryCeremonies() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      disabled={pending}
    >
      {pending ? "Loading…" : "Try again"}
    </button>
  );
}
