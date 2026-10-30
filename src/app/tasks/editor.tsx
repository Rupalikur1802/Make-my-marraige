"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  taskCreateSchema,
  responsibilities,
  taskStatuses,
  type TaskDTO,
} from "@/modules/tasks/validation";
import styles from "./tasks.module.css";
export type CeremonyOption = { id: string; name: string };
const blank = {
  title: "",
  notes: "",
  assigneeName: "Groom" as "Groom" | "Bride" | "Family",
  dueDate: "",
  eventId: "",
  status: "pending" as TaskDTO["status"],
};
function valuesFor(task?: TaskDTO) {
  return task
    ? {
        title: task.title,
        notes: task.notes,
        assigneeName: task.assigneeName,
        dueDate: task.dueDate ?? "",
        eventId: task.eventId ?? "",
        status: task.status,
      }
    : blank;
}
export function TaskEditor({
  task,
  events,
  action = task ? "edit" : "create",
  initiallyOpen = false,
}: {
  task?: TaskDTO;
  events: CeremonyOption[];
  action?: "create" | "edit" | "delete";
  initiallyOpen?: boolean;
}) {
  const router = useRouter(),
    dialog = useRef<HTMLDialogElement>(null),
    flight = useRef(false),
    attempt = useRef<{
      payload: string;
      key: string;
      uncertain: boolean;
    } | null>(null);
  const [open, setOpen] = useState(initiallyOpen),
    [base, setBase] = useState(task),
    [values, setValues] = useState(valuesFor(task)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [conflict, setConflict] = useState(false),
    [expired, setExpired] = useState(false),
    [missing, setMissing] = useState(false),
    [saved, setSaved] = useState("");
  const dirty = JSON.stringify(values) !== JSON.stringify(valuesFor(base));
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (!open || !dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [open, dirty]);
  function close() {
    if (busy) return;
    if (dirty && !window.confirm("Discard unsaved task changes?")) return;
    setOpen(false);
  }
  function start() {
    setBase(task);
    setValues(valuesFor(task));
    setError("");
    setFields({});
    setConflict(false);
    setExpired(false);
    setMissing(false);
    setSaved("");
    attempt.current = null;
    setOpen(true);
  }
  function change(key: keyof typeof blank, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setFields((f) => ({ ...f, [key]: "" }));
  }
  async function latest() {
    if (!base || flight.current) return;
    if (
      dirty &&
      !window.confirm(
        "Load the latest saved task? Your unsaved edits will be replaced.",
      )
    )
      return;
    flight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/tasks/" + base.id, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        setExpired(response.status === 401);
        setMissing(response.status === 404);
        throw new Error(
          result.error?.message ?? "Unable to load the latest task.",
        );
      }
      setBase(result.data);
      setValues(valuesFor(result.data));
      setConflict(false);
      setError("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load the task.");
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (flight.current || conflict || expired || missing) return;
    setError("");
    setFields({});
    const parsed = taskCreateSchema.safeParse({
      ...values,
      dueDate: values.dueDate || null,
      eventId: values.eventId || null,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        next[String(issue.path[0])] = issue.message;
      setFields(next);
      setError("Check the highlighted fields.");
      return;
    }
    const payload = JSON.stringify(
      base ? { ...parsed.data, expectedVersion: base.version } : parsed.data,
    );
    if (!base && attempt.current?.payload !== payload) {
      if (
        attempt.current?.uncertain &&
        !window.confirm(
          "The previous creation may have succeeded. Check the task list before creating a different task. Continue with a new creation attempt?",
        )
      )
        return;
      attempt.current = { payload, key: crypto.randomUUID(), uncertain: false };
    }
    flight.current = true;
    setBusy(true);
    let receivedResponse = false;
    try {
      const response = await fetch(
        base ? "/api/tasks/" + base.id : "/api/tasks",
        {
          method: base ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(!base ? { "Idempotency-Key": attempt.current!.key } : {}),
          },
          body: payload,
        },
      );
      const result = await response.json();
      receivedResponse = true;
      if (!response.ok) {
        setFields(result.error?.fields ?? {});
        setConflict(result.error?.code === "VERSION_CONFLICT");
        setExpired(response.status === 401);
        setMissing(response.status === 404);
        if (!base && attempt.current)
          attempt.current.uncertain = response.status >= 500;
        throw new Error(result.error?.message ?? "Could not save this task.");
      }
      setBase(result.data);
      setValues(valuesFor(result.data));
      setSaved(base ? "Task updated." : "Task created.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      if (!base && attempt.current && !receivedResponse)
        attempt.current.uncertain = true;
      setError(
        e instanceof Error
          ? e.message
          : "Could not save this task. Your entries are preserved.",
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (!base || flight.current || conflict || expired || missing) return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/tasks/" + base.id + "?expectedVersion=" + base.version,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = await response.json();
        setConflict(result.error?.code === "VERSION_CONFLICT");
        setExpired(response.status === 401);
        setMissing(response.status === 404);
        throw new Error(result.error?.message ?? "Could not delete this task.");
      }
      setSaved("Task deleted.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete this task.");
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  const input = (key: "title" | "dueDate") => (
    <>
      <input
        id={`task-${action}-${base?.id ?? "new"}-${key}`}
        name={key}
        type={key === "dueDate" ? "date" : "text"}
        maxLength={key === "title" ? 200 : undefined}
        value={values[key]}
        onChange={(e) => change(key, e.target.value)}
        required={key === "title"}
        aria-invalid={!!fields[key]}
        aria-describedby={
          fields[key]
            ? `task-${action}-${base?.id ?? "new"}-${key}-error`
            : undefined
        }
      />
      {fields[key] && (
        <span
          id={`task-${action}-${base?.id ?? "new"}-${key}-error`}
          className={styles.error}
        >
          {fields[key]}
        </span>
      )}
    </>
  );
  return (
    <>
      <button
        type="button"
        className={action === "create" ? styles.primary : styles.textButton}
        onClick={start}
      >
        {action === "create"
          ? "＋ Add task"
          : action === "delete"
            ? "Delete"
            : "Edit"}
      </button>
      {saved && (
        <span role="status" className={styles.success}>
          {saved}
        </span>
      )}
      {open && (
        <dialog
          ref={dialog}
          className={styles.dialog}
          aria-labelledby={`task-${action}-${base?.id ?? "new"}-heading`}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <header>
            <div>
              <p className={styles.eyebrow}>Shared wedding planner</p>
              <h2 id={`task-${action}-${base?.id ?? "new"}-heading`}>
                {action === "delete"
                  ? "Delete task"
                  : base
                    ? "Edit task"
                    : "Add task"}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              aria-label="Close task dialog"
            >
              ×
            </button>
          </header>
          {error && (
            <div role="alert" className={styles.alert}>
              {error}
              {conflict && (
                <button type="button" disabled={busy} onClick={latest}>
                  Load latest
                </button>
              )}
              {expired && <Link href="/login">Sign in again</Link>}
              {missing && <Link href="/tasks">Return to tasks</Link>}
            </div>
          )}
          {action === "delete" ? (
            <>
              <p>
                Permanently delete <strong>{base?.title}</strong>? This cannot
                be undone.
              </p>
              <div className={styles.dialogActions}>
                <button type="button" onClick={close} disabled={busy}>
                  Keep task
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy || conflict || expired || missing}
                >
                  {busy ? "Deleting…" : "Delete task"}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={submit} noValidate>
              <fieldset disabled={busy || expired || missing}>
                <label htmlFor={`task-${action}-${base?.id ?? "new"}-title`}>
                  Task title *{input("title")}
                </label>
                <div className={styles.formGrid}>
                  <label>
                    Responsibility *
                    <select
                      value={values.assigneeName}
                      onChange={(e) => change("assigneeName", e.target.value)}
                    >
                      {responsibilities.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Ceremony
                    <select
                      value={values.eventId}
                      onChange={(e) => change("eventId", e.target.value)}
                    >
                      <option value="">Wedding-wide</option>
                      {events.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    {fields.eventId && (
                      <span className={styles.error}>{fields.eventId}</span>
                    )}
                  </label>
                  <label>
                    Due date (optional){input("dueDate")}
                    <small>Calendar date in Indian Standard Time.</small>
                  </label>
                  <label>
                    Status
                    <select
                      value={values.status}
                      onChange={(e) => change("status", e.target.value)}
                    >
                      {taskStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s === "inProgress"
                            ? "In progress"
                            : s === "pending"
                              ? "Pending"
                              : "Completed"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Notes (optional)
                  <textarea
                    maxLength={2000}
                    rows={4}
                    value={values.notes}
                    onChange={(e) => change("notes", e.target.value)}
                    aria-invalid={!!fields.notes}
                  />
                  {fields.notes && (
                    <span className={styles.error}>{fields.notes}</span>
                  )}
                </label>
                <p className={styles.hint}>
                  Responsibility is a planning label. It sends no notifications
                  and grants no account access.
                </p>
              </fieldset>
              <div className={styles.dialogActions}>
                <button type="button" onClick={close} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primary}
                  disabled={busy || conflict || expired || missing}
                >
                  {busy ? "Saving…" : base ? "Save changes" : "Create task"}
                </button>
              </div>
            </form>
          )}
        </dialog>
      )}
    </>
  );
}
