import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { WeddingUnavailable } from "@/app/wedding/setup/shared";
import { WeddingFrame } from "@/app/workspace/frame";
import { listExpenses, getExpense } from "@/modules/expenses/service.server";
import { listCeremonies } from "@/modules/events/service.server";
import { AuthError } from "@/modules/auth/errors";
import {
  payers,
  formatRupees,
  type ExpenseDTO,
} from "@/modules/expenses/validation";
import { ExpenseEditor } from "./editor";
import { RefreshExpenses } from "./refresh";
import styles from "./expenses.module.css";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Expenses & spending | Make My Marriage",
  robots: { index: false, follow: false },
};
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await pageCouple();
  if (!actor) return <WeddingUnavailable />;
  const params = await searchParams,
    query = Object.fromEntries(
      Object.entries(params).filter(
        ([key, value]) =>
          key !== "expense" &&
          key !== "create" &&
          !(["from", "to"].includes(key) && value === ""),
      ),
    );
  let data, events;
  try {
    data = await listExpenses(actor, query);
    events = await listCeremonies(actor);
  } catch (error) {
    if (error instanceof AuthError && error.code === "SETUP_REQUIRED")
      redirect("/wedding/setup");
    return (
      <WeddingFrame email={actor.account.email}>
        <main className={styles.main}>
          <section className={styles.empty}>
            <h1>Unable to load expenses</h1>
            <p role="alert">
              Try again or clear invalid filters. Your recorded payments have
              not changed.
            </p>
            <RefreshExpenses />
            <Link href="/expenses">Clear filters</Link>
          </section>
        </main>
      </WeddingFrame>
    );
  }
  let selected: ExpenseDTO | undefined,
    selectionError = false;
  if (typeof params.expense === "string")
    try {
      selected = await getExpense(actor, params.expense);
    } catch {
      selectionError = true;
    }
  const text = (key: string) =>
      typeof params[key] === "string" ? (params[key] as string) : "",
    pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  function pageLink(page: number) {
    const values = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (typeof value === "string") values.set(key, value);
    values.set("page", String(page));
    return "/expenses?" + values;
  }
  return (
    <WeddingFrame email={actor.account.email}>
      <main className={styles.main}>
        <header className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>Financial ledger · Actual payments</p>
            <h1>Expenses &amp; spending</h1>
            <p>Keep a clear record of what you’ve spent on your wedding.</p>
          </div>
          <ExpenseEditor
            events={events}
            initiallyOpen={params.create === "1"}
          />
        </header>
        {selectionError && (
          <p className={styles.alert} role="alert">
            The selected expense is unavailable.{" "}
            <Link href="/expenses">Return to expenses</Link>
          </p>
        )}
        {selected && (
          <section className={styles.selected}>
            <span>Selected payment: {selected.description}</span>
            <ExpenseEditor
              key={selected.id}
              expense={selected}
              events={events}
              initiallyOpen
            />
          </section>
        )}
        <section
          className={styles.metrics}
          aria-label="Recorded spending totals"
        >
          <div>
            <span>Total recorded spending</span>
            <strong>{formatRupees(data.summary.totalPaise)}</strong>
            <small>{data.summary.count} payment records</small>
          </div>
          {data.summary.byPayer.map((payer) => (
            <div key={payer.payerKey}>
              <span>Paid by {payer.payerName}</span>
              <strong>{formatRupees(payer.totalPaise)}</strong>
              <small>Across the whole wedding</small>
            </div>
          ))}
        </section>
        <p className={styles.notice}>
          Summary cards and ceremony breakdown show totals across the whole
          wedding. Search and filters affect the expense list only.
        </p>
        <form action="/expenses" className={styles.filters}>
          <label>
            Search expenses
            <input
              name="q"
              type="search"
              maxLength={100}
              placeholder="Search by description"
              defaultValue={text("q")}
            />
          </label>
          <label>
            Payer
            <select name="payerKey" defaultValue={text("payerKey") || "all"}>
              <option value="all">All payers</option>
              {payers.map((payer) => (
                <option key={payer} value={payer.toLowerCase()}>
                  {payer}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ceremony
            <select name="eventId" defaultValue={text("eventId") || "all"}>
              <option value="all">All ceremonies</option>
              <option value="unassigned">Wedding-wide</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" name="from" defaultValue={text("from")} />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={text("to")} />
          </label>
          <button type="submit">Apply filters</button>
          <Link href="/expenses">Clear filters</Link>
        </form>
        <div className={styles.listHeading}>
          <p role="status">
            {data.total} matching payments · Page {data.page} of {pages} ·
            Newest date paid first
          </p>
          <RefreshExpenses />
        </div>
        {data.expenses.length ? (
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              Recorded payments already made
            </caption>
            <thead>
              <tr>
                {[
                  "Description",
                  "Amount (INR)",
                  "Date paid (IST)",
                  "Payer",
                  "Ceremony",
                  "Actions",
                ].map((header) => (
                  <th scope="col" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>
                    <strong>{expense.description}</strong>
                  </td>
                  <td>
                    <span className={styles.mobileLabel}>Amount paid</span>
                    <strong className={styles.amount}>
                      {formatRupees(expense.amountPaise)}
                    </strong>
                  </td>
                  <td>
                    <span className={styles.mobileLabel}>Date paid (IST)</span>
                    <time dateTime={expense.spentOn}>{expense.spentOn}</time>
                  </td>
                  <td>
                    <span className={styles.mobileLabel}>Payer</span>
                    <span className={styles.badge}>{expense.payerName}</span>
                  </td>
                  <td>
                    <span className={styles.mobileLabel}>Ceremony</span>
                    {expense.eventName ?? "Wedding-wide"}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <ExpenseEditor expense={expense} events={events} />
                      <ExpenseEditor
                        expense={expense}
                        events={events}
                        action="delete"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <section className={styles.empty}>
            <h2>
              {data.summary.count
                ? "No matching payments"
                : "No expenses recorded yet"}
            </h2>
            <p>
              {data.summary.count
                ? "Try another description, payer, ceremony or date range."
                : "Record your first payment already made. Estimates and unpaid balances are not included."}
            </p>
            {data.summary.count ? (
              <Link href="/expenses">Clear all filters</Link>
            ) : (
              <ExpenseEditor events={events} />
            )}
          </section>
        )}
        <nav className={styles.pagination} aria-label="Expense pages">
          {data.page > 1 && (
            <Link href={pageLink(data.page - 1)}>← Previous</Link>
          )}
          {data.page < pages && (
            <Link href={pageLink(data.page + 1)}>Next →</Link>
          )}
        </nav>
        <section className={styles.breakdown}>
          <p className={styles.eyebrow}>Ceremony allocations</p>
          <h2>Spending by ceremony</h2>
          {data.summary.byEvent.length ? (
            <ul>
              {data.summary.byEvent.map((event) => (
                <li key={event.eventId ?? "unassigned"}>
                  <span>{event.eventName}</span>
                  <strong>{formatRupees(event.totalPaise)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Recorded spending by ceremony will appear here.</p>
          )}
          <p className={styles.hint}>
            Wedding-wide payments remain included in overall and payer totals.
            Removing a ceremony preserves its payment records as Wedding-wide.
          </p>
        </section>
      </main>
    </WeddingFrame>
  );
}
