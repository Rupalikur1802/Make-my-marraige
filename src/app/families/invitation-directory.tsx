import Link from "next/link";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { invitationDirectory } from "@/modules/invitations/directory.server";
import { RetryFamilies } from "./retry";
import { RefreshInvitations } from "./refresh-invitations";
import styles from "./families.module.css";
const labels: Record<string, string> = {
  notSent: "Not sent",
  sending: "Submitting",
  submitted: "Submitted to email provider",
  failed: "Failed",
  uncertain: "Uncertain",
};
function timestamp(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value)) + " IST"
    : "—";
}
export async function InvitationDirectory({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const actor = await pageCouple();
  if (!actor) return null;
  let data;
  try {
    data = await invitationDirectory(
      actor,
      Object.fromEntries(
        Object.entries(params).filter(([key]) => key !== "section"),
      ),
    );
  } catch {
    return (
      <section className={styles.empty} role="alert">
        <h1>Unable to load invitations</h1>
        <p>
          Try again or clear the filters. Your invitations have not been
          changed.
        </p>
        <RetryFamilies />{" "}
        <Link href="/families?section=invitations">Clear filters</Link>
      </section>
    );
  }
  const text = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  function pageLink(page: number) {
    const query = new URLSearchParams({
      section: "invitations",
      q: text("q"),
      emailStatus: text("emailStatus") || "all",
      acceptance: text("acceptance") || "all",
      page: String(page),
      pageSize: String(data!.pageSize),
    });
    return "/families?" + query;
  }
  return (
    <>
      <div className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>
            Invitation desk · Send &amp; follow up
          </p>
          <h1>Invitations</h1>
          <p>
            Send private invitations and track email submission and family
            acceptance.
          </p>
        </div>
        <RefreshInvitations />
      </div>
      <div className={styles.summary}>
        <div className={styles.metric}>
          <span>Accepted invitations</span>
          <strong>{data.summary.accepted} families</strong>
        </div>
        <div className={styles.metric}>
          <span>Awaiting acceptance</span>
          <strong>
            {data.summary.families - data.summary.accepted} families
          </strong>
        </div>
      </div>
      <p className={styles.notice}>
        Email submission does not confirm delivery or acceptance. Acceptance is
        the family’s acknowledgement, separate from ceremony attendance.{" "}
        <Link href="/families">Manage guest details and assignments →</Link>
      </p>
      <form className={styles.filters} action="/families">
        <input type="hidden" name="section" value="invitations" />
        <label>
          Search invitations
          <input
            name="q"
            type="search"
            maxLength={100}
            defaultValue={text("q")}
            placeholder="Family name or email"
          />
        </label>
        <label>
          Email status
          <select
            name="emailStatus"
            defaultValue={text("emailStatus") || "all"}
          >
            <option value="all">All email statuses</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Acceptance
          <select name="acceptance" defaultValue={text("acceptance") || "all"}>
            <option value="all">All acceptance statuses</option>
            <option value="accepted">Accepted</option>
            <option value="awaiting">Awaiting acceptance</option>
          </select>
        </label>
        <button className={styles.secondary}>Search / filter</button>
        <Link href="/families?section=invitations">Clear filters</Link>
      </form>
      <p className={styles.muted} role="status">
        {data.total} matching families · Page {data.page} of {pages}
      </p>
      {data.rows.length ? (
        <table className={styles.table + " " + styles.invitationTable}>
          <caption className={styles.caption}>
            Invitation sending and acceptance
          </caption>
          <thead>
            <tr>
              <th scope="col">Family</th>
              <th scope="col">Current recipient email</th>
              <th scope="col">Email status</th>
              <th scope="col">Latest attempt</th>
              <th scope="col">Acceptance</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.name}</strong>
                </td>
                <td>
                  <span className={styles.mobileLabel}>
                    Current recipient email
                  </span>
                  {row.email ?? "Add an email before sending"}
                </td>
                <td>
                  <span className={styles.mobileLabel}>Email status</span>
                  {labels[row.emailStatus]}
                  {row.previousLink && (
                    <p className={styles.muted}>
                      Attempt used a previous invitation link.
                    </p>
                  )}
                </td>
                <td>
                  <span className={styles.mobileLabel}>Latest attempt</span>
                  {timestamp(row.submittedAt)}
                  {row.attemptedAt && !row.submittedAt && (
                    <p className={styles.muted}>
                      Prepared {timestamp(row.attemptedAt)}
                    </p>
                  )}
                </td>
                <td>
                  <span className={styles.mobileLabel}>Acceptance</span>
                  <strong>
                    {row.invitationAcceptedAt
                      ? "Accepted"
                      : "Awaiting acceptance"}
                  </strong>
                  {row.invitationAcceptedAt && (
                    <p>{timestamp(row.invitationAcceptedAt)}</p>
                  )}
                </td>
                <td>
                  <Link href={"/families/" + row.id + "/invitation"}>
                    Send / manage invitation →
                  </Link>
                  <p className={styles.muted}>
                    Preview, private link, send or retry
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <section className={styles.empty}>
          <h2>
            {data.summary.families
              ? "No matching invitations"
              : "Add guests before sending invitations"}
          </h2>
          <p>
            {data.summary.families
              ? "Try another search or clear the status filters."
              : "Create a family and assign published ceremonies in Guests, then return here to send their invitation."}
          </p>
          <Link
            href={
              data.summary.families
                ? "/families?section=invitations"
                : "/families/new"
            }
          >
            {data.summary.families ? "Clear filters" : "Add family"}
          </Link>
        </section>
      )}
      <div className={styles.pager}>
        {data.page > 1 && (
          <Link href={pageLink(data.page - 1)}>← Previous</Link>
        )}
        {data.page < pages && (
          <Link href={pageLink(data.page + 1)}>Next →</Link>
        )}
      </div>
    </>
  );
}
