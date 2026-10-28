"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { WeddingDTO } from "@/modules/wedding/validation";
import { isCalendarDate } from "@/modules/wedding/validation";
import styles from "./setup.module.css";

type Values = {
  groomName: string;
  brideName: string;
  weddingDate: string;
  venue: string;
};
const toValues = (wedding: WeddingDTO): Values => ({
  groomName: wedding.groomName ?? "",
  brideName: wedding.brideName ?? "",
  weddingDate: wedding.weddingDate ?? "",
  venue: wedding.venue ?? "",
});
export function SetupForm({ initial }: { initial: WeddingDTO }) {
  const router = useRouter();
  const [wedding, setWedding] = useState(initial);
  const [values, setValues] = useState(toValues(initial));
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Partial<Values>>({});
  const [conflict, setConflict] = useState(false);
  const [reloadBusy, setReloadBusy] = useState(false);
  const status = useRef<HTMLDivElement>(null);
  function announce() {
    requestAnimationFrame(() => status.current?.focus());
  }
  async function reload() {
    if (
      !window.confirm(
        "Load the latest saved details? This replaces your unsaved changes on this page.",
      )
    )
      return;
    setReloadBusy(true);
    try {
      const response = await fetch("/api/wedding", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) throw new Error();
      const body = await response.json();
      setWedding(body.data);
      setValues(toValues(body.data));
      setFields({});
      setConflict(false);
      setError("");
      setMessage("Latest saved details loaded.");
    } catch {
      setError(
        "Could not load the latest details. Your entries are still on this page.",
      );
    } finally {
      setReloadBusy(false);
      announce();
    }
  }
  async function save(complete: boolean) {
    if (inFlight.current || conflict || reloadBusy) return;
    const problems: Partial<Values> = {};
    const cleaned = {
      groomName: values.groomName.trim(),
      brideName: values.brideName.trim(),
      weddingDate: values.weddingDate,
      venue: values.venue.trim(),
    };
    if (complete || wedding.setupStatus === "complete") {
      if (!cleaned.groomName) problems.groomName = "Enter the groom’s name.";
      if (!cleaned.brideName) problems.brideName = "Enter the bride’s name.";
      if (!cleaned.weddingDate)
        problems.weddingDate = "Choose your wedding date.";
      if (!cleaned.venue) problems.venue = "Enter the venue and address.";
    }
    if (cleaned.weddingDate && !isCalendarDate(cleaned.weddingDate))
      problems.weddingDate = "Choose a valid calendar date.";
    setFields(problems);
    setMessage("");
    setError("");
    if (Object.keys(problems).length) {
      setError("Please check the highlighted details.");
      announce();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/wedding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          ...cleaned,
          expectedVersion: wedding.version,
          setupStatus:
            complete || wedding.setupStatus === "complete"
              ? "complete"
              : "draft",
        }),
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          setConflict(true);
          setError(
            "Your partner or another device saved changes. Load the latest details before saving again.",
          );
        } else {
          setError(
            body.error?.message ||
              "We couldn’t save your details. Your entries are still on this page; please retry.",
          );
          setFields(body.error?.fields ?? {});
        }
        return;
      }
      setWedding(body.data);
      setValues(toValues(body.data));
      if (complete || body.data.setupStatus === "complete") {
        router.replace("/workspace");
        router.refresh();
      } else
        setMessage(
          "Draft saved. You can return and continue from any signed-in device.",
        );
    } catch {
      setError(
        "We couldn’t save your details. Your entries are still on this page; check your connection and retry.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
      announce();
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(true);
  }
  const editing = wedding.setupStatus === "complete";
  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-busy={busy}>
      <div className={styles.formHeading}>
        <div>
          <p className="eyebrow">
            {editing ? "Your wedding details" : "Stage 01 / Primary registry"}
          </p>
          <h2>Ceremony specifications</h2>
        </div>
        <span>{editing ? "Setup complete" : "Wedding draft"}</span>
      </div>
      <div ref={status} tabIndex={-1} className={styles.status}>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {message && (
          <p role="status" className={styles.saved}>
            {message}
          </p>
        )}
      </div>
      <fieldset disabled={busy || reloadBusy} className={styles.fields}>
        {(["groomName", "brideName", "weddingDate", "venue"] as const).map(
          (key) => {
            const label = {
              groomName: "Groom’s name",
              brideName: "Bride’s name",
              weddingDate: "Wedding date",
              venue: "Venue & address",
            }[key];
            return (
              <div className={styles.field} key={key}>
                <label htmlFor={key}>
                  {label} <span aria-hidden="true">*</span>
                </label>
                {key === "venue" ? (
                  <textarea
                    id={key}
                    name={key}
                    rows={3}
                    maxLength={500}
                    value={values[key]}
                    onChange={(event) =>
                      setValues((previous) => ({
                        ...previous,
                        [key]: event.target.value,
                      }))
                    }
                    aria-required="true"
                    aria-invalid={!!fields[key]}
                    aria-describedby={fields[key] ? key + "-error" : undefined}
                    placeholder="Venue name and full address"
                  />
                ) : (
                  <input
                    id={key}
                    name={key}
                    type={key === "weddingDate" ? "date" : "text"}
                    value={values[key]}
                    maxLength={key === "weddingDate" ? undefined : 100}
                    onChange={(event) =>
                      setValues((previous) => ({
                        ...previous,
                        [key]: event.target.value,
                      }))
                    }
                    autoComplete="off"
                    aria-invalid={!!fields[key]}
                    aria-describedby={
                      fields[key]
                        ? key + "-error"
                        : key === "weddingDate"
                          ? "date-hint"
                          : undefined
                    }
                    placeholder={
                      key === "groomName"
                        ? "e.g. Arjun Sharma"
                        : key === "brideName"
                          ? "e.g. Priya Patel"
                          : undefined
                    }
                  />
                )}
                {key === "weddingDate" && (
                  <p id="date-hint">
                    Dates follow Indian Standard Time (Asia/Kolkata). Choose a
                    calendar date; no time is required.
                  </p>
                )}
                {fields[key] && (
                  <p id={key + "-error"} className={styles.fieldError}>
                    {fields[key]}
                  </p>
                )}
              </div>
            );
          },
        )}
      </fieldset>
      <p className={styles.note}>
        Save a draft with the details you have. Both names, wedding date and
        venue are required to complete setup. Ceremonies stay private drafts
        until a later publishing feature.
      </p>
      {conflict ? (
        <button
          className={styles.secondary}
          type="button"
          onClick={reload}
          disabled={reloadBusy}
        >
          {reloadBusy ? "Loading…" : "Load latest saved details"}
        </button>
      ) : (
        <div className={styles.actions}>
          {!editing && (
            <button
              className={styles.secondary}
              type="button"
              disabled={busy || reloadBusy}
              onClick={() => void save(false)}
            >
              Save draft
            </button>
          )}
          <button
            className={styles.primary}
            type="submit"
            disabled={busy || reloadBusy}
          >
            {busy
              ? "Saving…"
              : editing
                ? "Save wedding details"
                : "Complete setup & open workspace →"}
          </button>
        </div>
      )}
    </form>
  );
}
