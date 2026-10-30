import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { WeddingUnavailable } from "@/app/wedding/setup/shared";
import { WeddingFrame } from "@/app/workspace/frame";
import { listTasks, getTask } from "@/modules/tasks/service.server";
import { listCeremonies } from "@/modules/events/service.server";
import { AuthError } from "@/modules/auth/errors";
import {
  responsibilities,
  taskStatuses,
  type TaskDTO,
} from "@/modules/tasks/validation";
import { TaskEditor } from "./editor";
import { RefreshTasks } from "./refresh";
import styles from "./tasks.module.css";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tasks & responsibilities | Make My Marriage",
  robots: { index: false, follow: false },
};
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await pageCouple();
  if (!actor) return <WeddingUnavailable />;
  const params = await searchParams,
    query = Object.fromEntries(
      Object.entries(params).filter(
        ([key]) => key !== "task" && key !== "create",
      ),
    );
  let data, events;
  try {
    data = await listTasks(actor, query);
    events = await listCeremonies(actor);
  } catch (error) {
    if (error instanceof AuthError && error.code === "SETUP_REQUIRED")
      redirect("/wedding/setup");
    return (
      <WeddingFrame email={actor.account.email}>
        <main className={styles.main}>
          <section className={styles.empty}>
            <h1>Unable to load tasks</h1>
            <p role="alert">
              Try again or clear invalid filters. Your saved tasks have not
              changed.
            </p>
            <RefreshTasks />
            <Link href="/tasks">Clear filters</Link>
          </section>
        </main>
      </WeddingFrame>
    );
  }
  let selected: TaskDTO | undefined,
    selectionError = false;
  if (typeof params.task === "string")
    try {
      selected = await getTask(actor, params.task);
    } catch {
      selectionError = true;
    }
  const text = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  function pageLink(page: number) {
    const values = new URLSearchParams();
    for (const [k, v] of Object.entries(query))
      if (typeof v === "string") values.set(k, v);
    values.set("page", String(page));
    return "/tasks?" + values;
  }
  return (
    <WeddingFrame email={actor.account.email}>
      <main className={styles.main}>
        <header className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>
              Shared schedule · Wedding responsibilities
            </p>
            <h1>Tasks &amp; responsibilities</h1>
            <p>Keep track of what needs doing and who is taking care of it.</p>
          </div>
          <TaskEditor events={events} initiallyOpen={params.create === "1"} />
        </header>
        {selectionError && (
          <p role="alert" className={styles.alert}>
            The selected task is unavailable.{" "}
            <Link href="/tasks">Return to the task list</Link>
          </p>
        )}
        {selected && (
          <section className={styles.selected}>
            <span>Selected task: {selected.title}</span>
            <TaskEditor
              key={selected.id}
              task={selected}
              events={events}
              initiallyOpen
            />
          </section>
        )}
        <section className={styles.metrics} aria-label="Task totals">
          {(
            [
              ["Pending", data.summary.pending],
              ["In progress", data.summary.inProgress],
              ["Completed", data.summary.completed],
              ["Overdue", data.summary.overdue],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>
                {label === "Overdue"
                  ? "Incomplete with a past due date"
                  : "Across your wedding"}
              </small>
            </div>
          ))}
        </section>
        <form action="/tasks" className={styles.filters}>
          <label>
            Search tasks
            <input
              type="search"
              name="q"
              maxLength={100}
              defaultValue={text("q")}
              placeholder="Search by task title"
            />
          </label>
          <label>
            Responsibility
            <select
              name="assigneeName"
              defaultValue={text("assigneeName") || "all"}
            >
              <option value="all">All responsibilities</option>
              {responsibilities.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Ceremony
            <select name="eventId" defaultValue={text("eventId") || "all"}>
              <option value="all">All ceremonies</option>
              <option value="unassigned">Wedding-wide</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={text("status") || "all"}>
              <option value="all">All statuses</option>
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
          <label className={styles.checkbox}>
            <input
              name="overdue"
              value="true"
              type="checkbox"
              defaultChecked={text("overdue") === "true"}
            />
            Overdue only
          </label>
          <button type="submit">Apply filters</button>
          <Link href="/tasks">Clear filters</Link>
        </form>
        <div className={styles.listHeading}>
          <p role="status">
            {data.total} matching tasks · Page {data.page} of {pages}
          </p>
          <RefreshTasks />
        </div>
        {data.summary.total > 0 &&
          data.summary.completed === data.summary.total && (
            <p role="status" className={styles.celebration}>
              All tasks completed. Your wedding checklist is up to date.
            </p>
          )}
        {data.tasks.length ? (
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              Wedding tasks and responsibilities
            </caption>
            <thead>
              <tr>
                {[
                  "Task & details",
                  "Responsibility",
                  "Ceremony",
                  "Due date (IST)",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th scope="col" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <strong>{task.title}</strong>
                    {task.notes && <p className={styles.notes}>{task.notes}</p>}
                  </td>
                  <td>
                    <span className={styles.mobileLabel}>Responsibility</span>
                    <span className={styles.badge}>{task.assigneeName}</span>
                  </td>
                  <td>
                    <span className={styles.mobileLabel}>Ceremony</span>
                    {task.eventName ?? "Wedding-wide"}
                  </td>
                  <td>
                    <span className={styles.mobileLabel}>Due date (IST)</span>
                    {task.dueDate ?? "No due date"}
                    {task.isOverdue && (
                      <span className={styles.overdue}>Overdue</span>
                    )}
                  </td>
                  <td>
                    <span className={styles.mobileLabel}>Status</span>
                    <span
                      className={
                        styles.badge +
                        " " +
                        (task.status === "completed" ? styles.completed : "")
                      }
                    >
                      {task.status === "inProgress"
                        ? "In progress"
                        : task.status === "pending"
                          ? "Pending"
                          : "Completed"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <TaskEditor task={task} events={events} />
                      <TaskEditor task={task} events={events} action="delete" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <section className={styles.empty}>
            <h2>
              {data.summary.total
                ? "No matching tasks"
                : "Your wedding task list starts here"}
            </h2>
            <p>
              {data.summary.total
                ? "Try another search or clear the ceremony, responsibility and status filters."
                : "Add vendor calls, outfit fittings and hospitality tasks, and assign responsibility to Groom, Bride or Family."}
            </p>
            {data.summary.total ? (
              <Link href="/tasks">Clear all filters</Link>
            ) : (
              <TaskEditor events={events} />
            )}
          </section>
        )}
        <nav className={styles.pagination} aria-label="Task pages">
          {data.page > 1 && (
            <Link href={pageLink(data.page - 1)}>← Previous</Link>
          )}
          {data.page < pages && (
            <Link href={pageLink(data.page + 1)}>Next →</Link>
          )}
        </nav>
        <p className={styles.hint}>
          Overdue is calculated using today’s IST calendar date. Completed tasks
          are never overdue. Refresh to see changes made on another device.
        </p>
      </main>
    </WeddingFrame>
  );
}
