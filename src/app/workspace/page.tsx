import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { dashboard } from "@/modules/dashboard/service.server";
import { countdownLabel, weddingDateLabel } from "@/modules/dashboard/date";
import { ceremonyTiming } from "@/modules/events/validation";
import { formatRupees } from "@/modules/expenses/validation";
import { AuthError } from "@/modules/auth/errors";
import { WeddingUnavailable } from "@/app/wedding/setup/shared";
import { WeddingFrame } from "./frame";
import { DashboardActions, RefreshDashboard } from "./actions";
import styles from "./dashboard.module.css";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard | Make My Marriage",
  robots: { index: false, follow: false },
};
export default async function WorkspacePage() {
  const actor = await pageCouple();
  if (!actor) return <WeddingUnavailable />;
  let data;
  try {
    data = await dashboard(actor);
  } catch (error) {
    if (error instanceof AuthError && error.code === "SETUP_REQUIRED")
      redirect("/wedding/setup");
    return (
      <WeddingFrame email={actor.account.email}>
        <main className={styles.main}>
          <section className={styles.empty}>
            <h1>Dashboard temporarily unavailable</h1>
            <p role="alert">
              We couldn’t load your wedding summary. Please retry. Your saved
              details have not been changed.
            </p>
            <RefreshDashboard />
            <Link href="/families">Manage families</Link>
          </section>
        </main>
      </WeddingFrame>
    );
  }
  const {
    wedding,
    guests,
    invitationAcceptance,
    eventAttendance,
    upcomingEvents,
    tasks,
    tasksNeedingAttention,
    expenses,
  } = data;
  const percent = guests.families
    ? Math.round(
        (invitationAcceptance.acceptedFamilies / guests.families) * 100,
      )
    : 0;
  return (
    <WeddingFrame email={actor.account.email} wedding={wedding}>
      <a className="skip-link" href="#dashboard-content">
        Skip to dashboard
      </a>
      <main className={styles.main} id="dashboard-content">
        <header className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>
              Atelier command · Celebration ledger
            </p>
            <h1>
              Your wedding, <em>at a glance.</em>
            </h1>
            <p>
              Keep every celebration and family invitation serenely in view.
            </p>
          </div>
          <RefreshDashboard />
        </header>
        <section className={styles.hero} aria-labelledby="wedding-title">
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Celebration registry</p>
            <h2 id="wedding-title">
              {wedding.groomName} <em>&amp;</em> {wedding.brideName}
            </h2>
            <p>{weddingDateLabel(wedding.weddingDate)} · IST</p>
            <p>{wedding.venue}</p>
            <Link href="/wedding/setup">Edit wedding details ↗</Link>
          </div>
          <div className={styles.countdown}>
            <span>Sacred horizon</span>
            <strong>{countdownLabel(wedding.daysUntilWedding)}</strong>
          </div>
        </section>
        <DashboardActions />
        <section
          className={styles.metrics}
          aria-label="Wedding overview totals"
        >
          <Link href="/families">
            <span>Total families</span>
            <strong>{guests.families}</strong>
            <small>Households on your guest list</small>
          </Link>
          <Link href="/families">
            <span>Invited members</span>
            <strong>{guests.invitedMembers}</strong>
            <small>Invitation limits, not confirmed attendance</small>
          </Link>
          <Link href="/attendance">
            <span>Families with pending RSVPs</span>
            <strong>{guests.familiesWithPendingRsvp}</strong>
            <small>At least one unanswered published ceremony</small>
          </Link>
          <Link href="/families">
            <span>Accepted invitations</span>
            <strong>{invitationAcceptance.acceptedFamilies}</strong>
            <small>Family acknowledgements</small>
          </Link>
        </section>
        <div className={styles.planningGrid}>
          <section className={styles.panel} aria-labelledby="upcoming-title">
            <div className={styles.panelHeading}>
              <div>
                <p className={styles.eyebrow}>Your celebration schedule</p>
                <h2 id="upcoming-title">Upcoming ceremonies</h2>
              </div>
              <span className={styles.pill}>
                Next {upcomingEvents.length} ceremonies
              </span>
            </div>
            {upcomingEvents.length ? (
              <ol className={styles.upcoming}>
                {upcomingEvents.map((event) => (
                  <li key={event.eventId}>
                    <Image
                      className={styles.ceremonyImage}
                      src="/images/wedding-ceremony.jpg"
                      alt=""
                      width={64}
                      height={72}
                    />
                    <div className={styles.dateMark} aria-hidden="true">
                      <span>
                        {new Intl.DateTimeFormat("en-IN", {
                          month: "short",
                          timeZone: "Asia/Kolkata",
                        }).format(new Date(event.startsAt!))}
                      </span>
                      <strong>
                        {new Intl.DateTimeFormat("en-IN", {
                          day: "2-digit",
                          timeZone: "Asia/Kolkata",
                        }).format(new Date(event.startsAt!))}
                      </strong>
                    </div>
                    <div>
                      <h3>{event.eventName}</h3>
                      <span className={styles.published}>Published</span>
                      <p>{ceremonyTiming(event.startsAt)}</p>
                      <p>{event.venue}</p>
                      <Link href={"/ceremonies/" + event.eventId}>
                        View ceremony →
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.inlineEmpty}>
                <h3>No upcoming ceremonies</h3>
                <p>
                  Future published ceremonies will appear here, ordered by date
                  and time.
                </p>
              </div>
            )}
            <Link className={styles.panelLink} href="/ceremonies">
              Manage ceremonies →
            </Link>
          </section>
          <section
            className={styles.panel + " " + styles.acceptance}
            aria-labelledby="acceptance-title"
          >
            <p className={styles.eyebrow}>The people who matter</p>
            <h2 id="acceptance-title">Invitation acceptance</h2>
            <p>Acknowledgements from your invited families.</p>
            {guests.families ? (
              <>
                <div className={styles.acceptanceStats}>
                  <div>
                    <strong>{invitationAcceptance.acceptedFamilies}</strong>
                    <span>Accepted</span>
                  </div>
                  <div>
                    <strong>
                      {invitationAcceptance.awaitingAcceptanceFamilies}
                    </strong>
                    <span>Awaiting acceptance</span>
                  </div>
                </div>
                <div className={styles.progress} aria-hidden="true">
                  <span style={{ width: percent + "%" }} />
                </div>
                <p className={styles.subtle}>
                  {invitationAcceptance.acceptedFamilies} of {guests.families}{" "}
                  families have accepted their invitation.
                </p>
              </>
            ) : (
              <div className={styles.inlineEmpty}>
                <h3>Your family list starts here</h3>
                <p>Add your first family to start sharing invitations.</p>
                <Link href="/families/new">Add your first family →</Link>
              </div>
            )}
            <p className={styles.note}>
              Invitation acceptance is separate from ceremony attendance. It
              does not indicate email delivery or opening.
            </p>
            <Link className={styles.panelLink} href="/families">
              Manage families →
            </Link>
          </section>
        </div>
        <section
          className={styles.panel + " " + styles.attendance}
          aria-labelledby="attendance-title"
        >
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>
                Every ceremony, its own gathering
              </p>
              <h2 id="attendance-title">Event-wise RSVP overview</h2>
            </div>
            <Link href="/attendance">View all responses →</Link>
          </div>
          <p className={styles.note}>
            Attendance is counted separately for each ceremony. Families with
            more than one pending response are counted once in the overview card
            above.
          </p>
          {eventAttendance.length ? (
            <table className={styles.table}>
              <caption className={styles.srOnly}>
                Attendance by published ceremony
              </caption>
              <thead>
                <tr>
                  <th scope="col">Ceremony</th>
                  <th scope="col">Confirmed guests</th>
                  <th scope="col">Attending families</th>
                  <th scope="col">Not-attending families</th>
                  <th scope="col">Pending families</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {eventAttendance.map((event) => (
                  <tr key={event.eventId}>
                    <td>
                      <strong>{event.eventName}</strong>
                      <small>{ceremonyTiming(event.startsAt)}</small>
                      <small>{event.assignedFamilies} assigned families</small>
                    </td>
                    <td>
                      <span className={styles.mobileLabel}>
                        Confirmed guests
                      </span>
                      <strong className={styles.confirmed}>
                        {event.attendingMembers}
                      </strong>
                    </td>
                    <td>
                      <span className={styles.mobileLabel}>
                        Attending families
                      </span>
                      {event.attendingFamilies}
                    </td>
                    <td>
                      <span className={styles.mobileLabel}>
                        Not-attending families
                      </span>
                      {event.notAttendingFamilies}
                    </td>
                    <td>
                      <span className={styles.mobileLabel}>
                        Pending families
                      </span>
                      {event.pendingFamilies}
                    </td>
                    <td>
                      {event.assignedFamilies ? (
                        <Link href={"/attendance?eventId=" + event.eventId}>
                          View responses →
                        </Link>
                      ) : (
                        <Link href="/families">Assign families →</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.inlineEmpty}>
              <h3>No published ceremonies yet</h3>
              <p>
                Publish your ceremonies, then assign families to collect their
                responses.
              </p>
              <Link href="/ceremonies">Manage ceremonies →</Link>
            </div>
          )}
        </section>
        <section
          className={styles.taskSummary}
          aria-labelledby="task-summary-title"
        >
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Shared responsibilities</p>
              <h2 id="task-summary-title">Tasks needing attention</h2>
            </div>
            <div className={styles.taskCounts}>
              <span>{tasks.pending} pending</span>
              <span>{tasks.inProgress} in progress</span>
              <span>{tasks.overdue} overdue</span>
            </div>
          </div>
          <p className={styles.subtle}>
            Incomplete tasks, ordered by due date. Overdue tasks come first;
            tasks without a due date come last.
          </p>
          {tasksNeedingAttention.length ? (
            <ul className={styles.taskList}>
              {tasksNeedingAttention.map((task) => (
                <li key={task.id}>
                  <Link href={"/tasks?task=" + task.id}>
                    <strong>{task.title}</strong>
                    <span>
                      {task.assigneeName} · {task.eventName ?? "Wedding-wide"} ·{" "}
                      {task.dueDate ?? "No due date"}
                      {task.dueDate ? " IST" : ""}
                    </span>
                  </Link>
                  {task.isOverdue && (
                    <span className={styles.taskOverdue}>Overdue</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>
              {tasks.total
                ? "All tasks completed. Your checklist is up to date."
                : "No tasks yet. Add your first responsibility to start planning."}
            </p>
          )}
          <div className={styles.actions}>
            <Link href="/tasks?create=1">＋ Add task</Link>
            <Link href="/tasks">View all tasks →</Link>
          </div>
        </section>
        <section
          className={styles.taskSummary}
          aria-labelledby="spending-summary-title"
        >
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Payments already made</p>
              <h2 id="spending-summary-title">Recorded spending</h2>
            </div>
            <Link href="/expenses">View all expenses →</Link>
          </div>
          <div className={styles.spendingTotals}>
            <div>
              <span>Total recorded</span>
              <strong>{formatRupees(expenses.totalPaise)}</strong>
            </div>
            {expenses.byPayer.map((payer) => (
              <div key={payer.payerKey}>
                <span>Paid by {payer.payerName}</span>
                <strong>{formatRupees(payer.totalPaise)}</strong>
              </div>
            ))}
          </div>
          {expenses.recent.length ? (
            <ul className={styles.taskList}>
              {expenses.recent.map((expense) => (
                <li key={expense.id}>
                  <Link href={"/expenses?expense=" + expense.id}>
                    <strong>{expense.description}</strong>
                    <span>
                      {expense.payerName} · {expense.spentOn} IST ·{" "}
                      {expense.eventName ?? "Wedding-wide"}
                    </span>
                  </Link>
                  <strong>{formatRupees(expense.amountPaise)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>
              No expenses recorded yet. Add your first payment already made.
            </p>
          )}
          <p className={styles.subtle}>
            Only recorded payments are included. No estimates or outstanding
            balances.
          </p>
          <div className={styles.actions}>
            <Link href="/expenses?create=1">＋ Record expense</Link>
          </div>
        </section>
        <section className={styles.archive} aria-label="Wedding inspiration">
          <p className={styles.eyebrow}>Atelier aesthetic archive</p>
          <h2>Atmosphere &amp; celebration inspiration</h2>
          <div>
            <figure>
              <Image
                src="/images/login-mandap.jpg"
                alt="Illustrative ivory floral wedding mandap"
                width={1200}
                height={896}
                sizes="(max-width: 900px) 100vw, 35vw"
              />
              <figcaption>Venue sanctuary · Wedding inspiration</figcaption>
            </figure>
            <figure>
              <Image
                src="/images/login-reception.jpg"
                alt="Illustrative candlelit wedding reception"
                width={1200}
                height={896}
                sizes="(max-width: 900px) 100vw, 35vw"
              />
              <figcaption>
                Evening celebrations · Wedding inspiration
              </figcaption>
            </figure>
          </div>
        </section>
        <p className={styles.subtle}>
          Your dashboard uses the latest saved records when loaded. Refresh to
          see new responses.
        </p>
      </main>
    </WeddingFrame>
  );
}
