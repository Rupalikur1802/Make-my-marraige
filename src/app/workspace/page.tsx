import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import {
  getWedding,
  getSetupCeremonies,
} from "@/modules/wedding/service.server";
import { ceremonyPresets } from "@/modules/wedding/presets";
import {
  WeddingHeader,
  WeddingFooter,
  WeddingUnavailable,
} from "@/app/wedding/setup/shared";
import styles from "@/app/wedding/setup/setup.module.css";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your wedding | Make My Marriage",
  robots: { index: false, follow: false },
};
export default async function WorkspacePage() {
  const actor = await pageCouple();
  if (!actor) return <WeddingUnavailable />;
  let wedding, events;
  try {
    wedding = await getWedding(actor);
    events = await getSetupCeremonies(actor);
  } catch {
    return <WeddingUnavailable />;
  }
  if (wedding.setupStatus !== "complete") redirect("/wedding/setup");
  const date = wedding.weddingDate
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "long",
        timeZone: "Asia/Kolkata",
      }).format(new Date(wedding.weddingDate + "T00:00:00+05:30"))
    : "Not set";
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#wedding-content">
        Skip to your wedding
      </a>
      <WeddingHeader email={actor.account.email} />
      <main className={styles.main} id="wedding-content">
        <div className={styles.overviewIntro}>
          <p className={styles.pill}>Your wedding atelier · Setup complete</p>
          <h1>Your celebration starts here.</h1>
          <p>
            Your wedding details are saved. We’ve added your first draft
            ceremonies so you can build on them in the next step.
          </p>
        </div>
        <div className={styles.overviewGrid}>
          <section className={styles.summary} aria-labelledby="summary-title">
            <div className={styles.summaryHeading}>
              <h2 id="summary-title">Your wedding details</h2>
              <span className={styles.pill}>Setup complete</span>
            </div>
            <div className={styles.couple}>
              <p className="eyebrow">The couple</p>
              <h3>
                {wedding.groomName} <em>&amp;</em> {wedding.brideName}
              </h3>
            </div>
            <dl className={styles.details}>
              <div>
                <dt>Wedding date</dt>
                <dd>
                  {date} <small>(IST)</small>
                </dd>
              </div>
              <div>
                <dt>Venue &amp; address</dt>
                <dd>{wedding.venue}</dd>
              </div>
            </dl>
            <div className={styles.editRow}>
              <p>Need to update a name, date or venue?</p>
              <Link className={styles.primary} href="/wedding/setup">
                Edit wedding details →
              </Link>
            </div>
          </section>
          <aside className={styles.overviewImage}>
            <Image
              src="/images/login-reception.jpg"
              alt="Candlelit wedding reception tables with ivory flowers"
              width={1200}
              height={896}
              sizes="(max-width: 900px) 100vw, 30vw"
            />
            <h2>A thoughtful beginning.</h2>
            <p>Your celebration’s essentials, together in one shared space.</p>
          </aside>
        </div>
        <section className={styles.ceremonies} aria-labelledby="ceremony-title">
          <div className={styles.ceremonyHeading}>
            <div>
              <h2 id="ceremony-title">Ceremonies</h2>
              <p>
                Your saved ceremonies. Editing and publishing arrive in the next
                feature.
              </p>
            </div>
            <span className={styles.pill}>
              {events.length} draft ceremonies
            </span>
          </div>
          <ol className={styles.ceremonyGrid}>
            {events.map((event, index) => (
              <li key={event.id}>
                <span className={styles.sequence}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>
                    {event.name}{" "}
                    <em>
                      {
                        ceremonyPresets.find(
                          (preset) => preset.key === event.presetKey,
                        )?.subtitle
                      }
                    </em>
                  </h3>
                  <span className={styles.draft}>{event.status}</span>
                  <p>Date, time, and venue not yet configured</p>
                </div>
              </li>
            ))}
          </ol>
          <p className={styles.note}>
            These ceremonies are drafts and are not visible to guests.
            Completing or editing setup does not publish events or send
            invitations.
          </p>
        </section>
      </main>
      <WeddingFooter />
    </div>
  );
}
