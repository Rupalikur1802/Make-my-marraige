"use client";
import { useEffect, useRef } from "react";
import styles from "./families.module.css";
export function Confirm({
  title,
  children,
  busy = false,
  confirmDisabled = false,
  cancelLabel = "Cancel",
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  busy?: boolean;
  confirmDisabled?: boolean;
  cancelLabel?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="family-confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="family-confirm-title">{title}</h2>
      {children}
      <div className={styles.actions}>
        <button
          className={styles.secondary}
          type="button"
          autoFocus
          disabled={busy}
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          className={danger ? styles.danger : styles.primary}
          type="button"
          disabled={busy || confirmDisabled}
          onClick={onConfirm}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
