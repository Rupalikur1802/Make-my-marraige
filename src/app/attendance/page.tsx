import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { attendanceSummary } from "@/modules/rsvp/service.server";
import { responseLabel, responseTime } from "@/modules/rsvp/validation";
import { ceremonyTiming } from "@/modules/events/validation";
import { AuthError } from "@/modules/auth/errors";
import { WeddingUnavailable } from "@/app/wedding/setup/shared";
import { RefreshAttendance } from "./refresh";
import styles from "./attendance.module.css";
import { WeddingFrame } from "@/app/workspace/frame";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Attendance | Make My Marriage",
  robots: { index: false, follow: false },
};
export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await pageCouple();
  if (!actor) return <WeddingUnavailable />;
  const params = await searchParams;
  const query = Object.fromEntries(
    Object.entries(params).filter(
      ([key, value]) =>
        value !== undefined &&
        !(value === "" && ["status", "eventId"].includes(key)),
    ),
  );
  let data;
  try {
    data = await attendanceSummary(actor, query);
  } catch (error) {
    if (error instanceof AuthError && error.code === "SETUP_REQUIRED")
      redirect("/wedding/setup");
    return (
      <WeddingFrame email={actor.account.email}>
        <main className={styles.main}>
          <h1>Unable to load attendance</h1>
          <p role="alert">
            {error instanceof AuthError
              ? error.message
              : "Please retry, or clear invalid filters."}
          </p>
          <RefreshAttendance /> <Link href="/attendance">Clear filters</Link>{" "}
          <Link href="/workspace">Wedding overview</Link>
        </main>
      </WeddingFrame>
    );
  }
  const q = typeof params.q === "string" ? params.q : "",
    status = typeof params.status === "string" ? params.status : "",
    pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  function url(nextStatus = status, page = 1, search = q) {
    const p = new URLSearchParams({
      page: String(page),
      pageSize: String(data!.pageSize),
    });
    if (data!.selected) p.set("eventId", data!.selected.id);
    if (nextStatus) p.set("status", nextStatus);
    if (search) p.set("q", search);
    return "/attendance?" + p;
  }
  return (
    <WeddingFrame email={actor.account.email}>
      <a className="skip-link" href="#attendance-content">
        Skip to attendance
      </a>
      <main id="attendance-content" className={styles.main}>
        <header className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>
              Guest responses · Ceremony by ceremony
            </p>
            <h1>Attendance &amp; RSVP</h1>
            <p>
              See which families are coming and plan for the confirmed guests.
            </p>
          </div>
          <RefreshAttendance />
        </header>
        {!data.ceremonies.length ? (
          <section className={styles.empty}>
            <h2>No published ceremonies yet</h2>
            <p>
              Publish a ceremony and assign families to begin collecting
              responses.
            </p>
            <Link href="/ceremonies">Manage ceremonies</Link>
          </section>
        ) : (
          <>
            <form action="/attendance" className={styles.filters}>
              <label>
                Ceremony
                <select name="eventId" defaultValue={data.selected!.id}>
                  {data.ceremonies.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Search families
                <input
                  name="q"
                  type="search"
                  maxLength={100}
                  defaultValue={q}
                  placeholder="Family name"
                />
              </label>
              <label>
                Response
                <select name="status" defaultValue={status}>
                  <option value="">All responses</option>
                  <option value="attending">Attending</option>
                  <option value="notAttending">Not attending</option>
                  <option value="pending">Pending</option>
                </select>
              </label>
              <button>Apply filters</button>
            </form>
            <section className={styles.ceremony}>
              <h2>{data.selected!.name}</h2>
              <p>{ceremonyTiming(data.selected!.startsAt)}</p>
              <p>{data.selected!.venue}</p>
            </section>
            <div className={styles.metrics}>
              {[
                ["Confirmed guests", data.summary.confirmedGuests],
                ["Attending families", data.summary.attendingFamilies],
                ["Not attending families", data.summary.notAttendingFamilies],
                ["Pending families", data.summary.pendingFamilies],
              ].map(([label, value]) => (
                <section key={label}>
                  <p>{label}</p>
                  <strong>{value}</strong>
                </section>
              ))}
            </div>
            <p className={styles.notice}>
              Invitation acceptance is separate from ceremony attendance. Totals
              cover all {data.summary.assignedFamilies} assigned families for
              this ceremony, regardless of the filters below.
            </p>
            <nav aria-label="Filter by response" className={styles.tabs}>
              {[
                ["", "All", data.summary.assignedFamilies],
                ["attending", "Attending", data.summary.attendingFamilies],
                [
                  "notAttending",
                  "Not attending",
                  data.summary.notAttendingFamilies,
                ],
                ["pending", "Pending", data.summary.pendingFamilies],
              ].map(([value, label, total]) => (
                <Link
                  key={value}
                  href={url(String(value))}
                  aria-current={status === value ? "page" : undefined}
                >
                  {label} ({total})
                </Link>
              ))}
            </nav>
            {data.rows.length ? (
              <table className={styles.table}>
                <caption className={styles.caption}>
                  Family responses for {data.selected!.name}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Family</th>
                    <th scope="col">Invitation</th>
                    <th scope="col">Invited limit</th>
                    <th scope="col">Ceremony response</th>
                    <th scope="col">Attending</th>
                    <th scope="col">Last response</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.invitationId}>
                      <td>
                        <strong>{row.familyName}</strong>
                      </td>
                      <td>
                        <span className={styles.mobileLabel}>Invitation</span>
                        {row.invitationAcceptedAt
                          ? "Accepted"
                          : "Awaiting acceptance"}
                      </td>
                      <td>
                        <span className={styles.mobileLabel}>
                          Invited limit
                        </span>
                        {row.invitedCount} members
                      </td>
                      <td>
                        <span className={styles.mobileLabel}>
                          Ceremony response
                        </span>
                        <span className={styles.badge} data-status={row.status}>
                          {responseLabel(row.status)}
                        </span>
                      </td>
                      <td>
                        <span className={styles.mobileLabel}>Attending</span>
                        {row.status === "pending" ? "—" : row.attendingCount}
                      </td>
                      <td>
                        <span className={styles.mobileLabel}>
                          Last response
                        </span>
                        {responseTime(row.respondedAt)}
                      </td>
                      <td>
                        <Link href={"/families/" + row.familyId}>
                          View family
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <section className={styles.empty}>
                <h2>
                  {data.summary.assignedFamilies
                    ? "No matching families"
                    : "No families assigned"}
                </h2>
                <p>
                  {data.summary.assignedFamilies
                    ? "Try another family name or clear your response filters."
                    : "Assign families to this ceremony to collect their responses."}
                </p>
                {data.summary.assignedFamilies ? (
                  <Link href={url("", 1, "")}>Clear filters</Link>
                ) : (
                  <Link href="/families">Manage families</Link>
                )}
              </section>
            )}
            <nav className={styles.pagination} aria-label="Attendance pages">
              <p>
                {data.total} matching families · Page {data.page} of {pages}
              </p>
              {data.page > 1 && (
                <Link href={url(status, data.page - 1)}>Previous</Link>
              )}
              {data.page < pages && (
                <Link href={url(status, data.page + 1)}>Next</Link>
              )}
            </nav>
          </>
        )}
        <p className={styles.notice}>
          Guests submit and update their own responses through their private
          invitation links. Refresh to see the latest responses.
        </p>
      </main>
    </WeddingFrame>
  );
}
