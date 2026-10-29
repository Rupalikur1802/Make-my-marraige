import Link from "next/link";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { listFamilies } from "@/modules/families/service.server";
import { listCeremonies } from "@/modules/events/service.server";
import { FamilyRows } from "./rows";
import { RetryFamilies } from "./retry";
import styles from "./families.module.css";
export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await pageCouple();
  if (!actor) return null;
  const params = await searchParams;
  const query = Object.fromEntries(
    Object.entries(params).filter(
      ([key, value]) =>
        key !== "deleted" &&
        key !== "saved" &&
        !(key === "eventId" && value === ""),
    ),
  );
  let data, events;
  try {
    data = await listFamilies(actor, query);
    events = await listCeremonies(actor);
  } catch {
    return (
      <div className={styles.empty} role="alert">
        <h1>Unable to load families</h1>
        <p>
          Try again, or clear invalid search filters. Your saved families have
          not been changed.
        </p>
        <RetryFamilies /> <Link href="/families">Clear filters</Link>
      </div>
    );
  }
  const q = typeof params.q === "string" ? params.q : "",
    eventId = typeof params.eventId === "string" ? params.eventId : "";
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  function pageLink(page: number) {
    const values = new URLSearchParams({
      page: String(page),
      pageSize: String(data!.pageSize),
    });
    if (q) values.set("q", q);
    if (eventId) values.set("eventId", eventId);
    return "/families?" + values;
  }
  return (
    <>
      <div className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Directory · Household records</p>
          <h1>Families</h1>
          <p>
            Organise your families and choose the ceremonies they’re invited to.
          </p>
        </div>
        <Link className={styles.primary} href="/families/new">
          ＋ Add family
        </Link>
      </div>
      {params.deleted === "1" && (
        <p role="status" className={styles.success}>
          Family deleted. Other families and ceremonies remain unchanged.
        </p>
      )}
      {params.saved === "1" && (
        <p role="status" className={styles.success}>
          Family saved.
        </p>
      )}
      <div className={styles.summary}>
        <div className={styles.metric}>
          <span>Saved families</span>
          <strong>{data.summary.families} households</strong>
        </div>
        <div className={styles.metric}>
          <span>Invited members</span>
          <strong>{data.summary.invitedMembers} members</strong>
        </div>
      </div>
      <p className={styles.muted}>
        Invited totals describe household sizes, not confirmed attendance.
      </p>
      <form className={styles.filters} action="/families">
        <label>
          Search families
          <input
            type="search"
            name="q"
            maxLength={100}
            defaultValue={q}
            placeholder="Family name or invitation email"
          />
        </label>
        <label>
          Ceremony
          <select name="eventId" defaultValue={eventId}>
            <option value="">All ceremonies</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <button className={styles.secondary}>Search / filter</button>
        <Link href="/families">Clear filters</Link>
      </form>
      <p className={styles.muted} role="status">
        {data.total} matching {data.total === 1 ? "family" : "families"} · Page{" "}
        {data.page} of {pages}
      </p>
      {data.families.length ? (
        <FamilyRows families={data.families} />
      ) : (
        <section className={styles.empty}>
          <h2>
            {data.summary.families === 0
              ? "Your family list starts here"
              : "No matching families"}
          </h2>
          <p>
            {data.summary.families === 0
              ? "Add your first family and choose its ceremonies."
              : "Try another search or clear the ceremony filter."}
          </p>
          <Link
            href={data.summary.families === 0 ? "/families/new" : "/families"}
          >
            {data.summary.families === 0 ? "Add family" : "Clear filters"}
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
      <p className={styles.notice}>
        Family records and ceremony assignments only. Saving does not send
        invitation emails. Choose Manage invitation to generate a private link,
        preview it, and explicitly confirm an email send.
      </p>
    </>
  );
}
