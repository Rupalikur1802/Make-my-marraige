"use client";
import { useRouter } from "next/navigation";
import styles from "./families.module.css";
export function RetryFamilies() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={styles.secondary}
      onClick={() => router.refresh()}
    >
      Try again
    </button>
  );
}
