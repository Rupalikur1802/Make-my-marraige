"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  expenseCreateSchema,
  payers,
  parseRupees,
  rupeeInput,
  formatRupees,
  todayIst,
  type ExpenseDTO,
} from "@/modules/expenses/validation";
import styles from "./expenses.module.css";
export type CeremonyOption = { id: string; name: string };
const blank = {
  description: "",
  amount: "",
  spentOn: "",
  payerName: "Groom" as "Groom" | "Bride" | "Family",
  eventId: "",
};
function valuesFor(expense?: ExpenseDTO) {
  return expense
    ? {
        description: expense.description,
        amount: rupeeInput(expense.amountPaise),
        spentOn: expense.spentOn,
        payerName: expense.payerName,
        eventId: expense.eventId ?? "",
      }
    : { ...blank, spentOn: todayIst() };
}
export function ExpenseEditor({
  expense,
  events,
  action = expense ? "edit" : "create",
  initiallyOpen = false,
}: {
  expense?: ExpenseDTO;
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
    [base, setBase] = useState(expense),
    [values, setValues] = useState(valuesFor(expense)),
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
    if (dirty && !window.confirm("Discard unsaved expense changes?")) return;
    setOpen(false);
  }
  function start() {
    setBase(expense);
    setValues(valuesFor(expense));
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
        "Load the latest saved expense? Your unsaved edits will be replaced.",
      )
    )
      return;
    flight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/expenses/" + base.id, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        setExpired(response.status === 401);
        setMissing(response.status === 404);
        throw new Error(
          result.error?.message ?? "Unable to load the latest expense.",
        );
      }
      setBase(result.data);
      setValues(valuesFor(result.data));
      setConflict(false);
      setError("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load the expense.");
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
    const parsed = expenseCreateSchema.safeParse({
      description: values.description,
      amountPaise: parseRupees(values.amount),
      spentOn: values.spentOn,
      payerName: values.payerName,
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
    if (parsed.data.spentOn > todayIst()) {
      setFields({ spentOn: "Date paid cannot be in the future." });
      setError("Record only payments already made.");
      return;
    }
    const payload = JSON.stringify(
      base ? { ...parsed.data, expectedVersion: base.version } : parsed.data,
    );
    if (!base && attempt.current?.payload !== payload) {
      if (
        attempt.current?.uncertain &&
        !window.confirm(
          "The previous creation may have succeeded. Check the expense list before creating a different expense. Continue with a new creation attempt?",
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
        base ? "/api/expenses/" + base.id : "/api/expenses",
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
        throw new Error(
          result.error?.message ?? "Could not save this expense.",
        );
      }
      setBase(result.data);
      setValues(valuesFor(result.data));
      setSaved(base ? "Expense updated." : "Expense created.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      if (!base && attempt.current && !receivedResponse)
        attempt.current.uncertain = true;
      setError(
        e instanceof Error
          ? e.message
          : "Could not save this expense. Your entries are preserved.",
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
        "/api/expenses/" + base.id + "?expectedVersion=" + base.version,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = await response.json();
        setConflict(result.error?.code === "VERSION_CONFLICT");
        setExpired(response.status === 401);
        setMissing(response.status === 404);
        throw new Error(
          result.error?.message ?? "Could not delete this expense.",
        );
      }
      setSaved("Expense deleted.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not delete this expense.",
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  function fieldError(key: string) {
    return fields[key] ? (
      <span
        className={styles.error}
        id={`expense-${action}-${base?.id ?? "new"}-${key}-error`}
      >
        {fields[key]}
      </span>
    ) : null;
  }
  return (
    <>
      <button
        type="button"
        className={action === "create" ? styles.primary : styles.textButton}
        onClick={start}
      >
        {action === "create"
          ? "＋ Record expense"
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
          aria-labelledby={`expense-${action}-${base?.id ?? "new"}-heading`}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
        >
          <header>
            <div>
              <p className={styles.eyebrow}>Payments already made · INR</p>
              <h2 id={`expense-${action}-${base?.id ?? "new"}-heading`}>
                {action === "delete"
                  ? "Delete expense record"
                  : base
                    ? "Edit expense"
                    : "Record expense"}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              aria-label="Close expense dialog"
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
              {missing && <Link href="/expenses">Return to expenses</Link>}
            </div>
          )}
          {action === "delete" ? (
            <>
              <p>
                Permanently delete <strong>{base?.description}</strong> —{" "}
                {base && formatRupees(base.amountPaise)}?
              </p>
              <p className={styles.hint}>
                Deleting this record does not refund or reverse the actual
                payment. This cannot be undone.
              </p>
              <div className={styles.dialogActions}>
                <button type="button" onClick={close} disabled={busy}>
                  Keep expense
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy || conflict || expired || missing}
                >
                  {busy ? "Deleting…" : "Delete expense"}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={submit} noValidate>
              <fieldset disabled={busy || expired || missing}>
                <p className={styles.hint}>
                  Record payments already made. For a payment shared by multiple
                  payers, add a separate entry for each contribution.
                </p>
                <label>
                  Description *
                  <textarea
                    name="description"
                    rows={3}
                    required
                    maxLength={300}
                    value={values.description}
                    onChange={(event) =>
                      change("description", event.target.value)
                    }
                    aria-invalid={!!fields.description}
                    aria-describedby={
                      fields.description
                        ? `expense-${action}-${base?.id ?? "new"}-description-error`
                        : undefined
                    }
                  />
                  {fieldError("description")}
                </label>
                <div className={styles.formGrid}>
                  <label>
                    Amount paid (₹) *
                    <input
                      name="amount"
                      type="text"
                      inputMode="decimal"
                      required
                      maxLength={25}
                      placeholder="0.00"
                      value={values.amount}
                      onChange={(event) => {
                        change("amount", event.target.value);
                        setFields((f) => ({ ...f, amountPaise: "" }));
                      }}
                      aria-invalid={!!fields.amountPaise}
                      aria-describedby={
                        fields.amountPaise
                          ? `expense-${action}-${base?.id ?? "new"}-amountPaise-error`
                          : undefined
                      }
                    />
                    <small>
                      Positive amount, up to two decimals. No commas.
                    </small>
                    {fieldError("amountPaise")}
                  </label>
                  <label>
                    Date paid *
                    <input
                      name="spentOn"
                      type="date"
                      max={todayIst()}
                      required
                      value={values.spentOn}
                      onChange={(event) =>
                        change("spentOn", event.target.value)
                      }
                      aria-invalid={!!fields.spentOn}
                      aria-describedby={
                        fields.spentOn
                          ? `expense-${action}-${base?.id ?? "new"}-spentOn-error`
                          : undefined
                      }
                    />
                    <small>
                      Calendar date in IST. Future dates are not allowed.
                    </small>
                    {fieldError("spentOn")}
                  </label>
                  <label>
                    Payer *
                    <select
                      value={values.payerName}
                      onChange={(event) =>
                        change("payerName", event.target.value)
                      }
                    >
                      {payers.map((payer) => (
                        <option key={payer}>{payer}</option>
                      ))}
                    </select>
                    {fieldError("payerName")}
                  </label>
                  <label>
                    Ceremony (optional)
                    <select
                      value={values.eventId}
                      onChange={(event) =>
                        change("eventId", event.target.value)
                      }
                    >
                      <option value="">Wedding-wide</option>
                      {events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.name}
                        </option>
                      ))}
                    </select>
                    {fieldError("eventId")}
                  </label>
                </div>
                <p className={styles.hint}>
                  Payer labels are planning categories, not separate accounts.
                  Saving records a payment; it does not move money.
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
                  {busy ? "Saving…" : base ? "Save changes" : "Save expense"}
                </button>
              </div>
            </form>
          )}
        </dialog>
      )}
    </>
  );
}
