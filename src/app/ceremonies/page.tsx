import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { getWedding } from "@/modules/wedding/service.server";
import { listCeremonies } from "@/modules/events/service.server";
import { WeddingUnavailable } from "@/app/wedding/setup/shared";
import { CeremonyList } from "./ceremony-list";
import { RetryCeremonies } from "./retry";
import styles from "./ceremonies.module.css";
import { WeddingFrame } from "@/app/workspace/frame";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ceremonies | Make My Marriage",
  robots: { index: false, follow: false },
};
export default async function CeremoniesPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const deleted = (await searchParams).deleted === "1";
  const actor = await pageCouple();
  if (!actor) return <WeddingUnavailable />;
  let wedding;
  try {
    wedding = await getWedding(actor);
  } catch {
    return <WeddingUnavailable />;
  }
  if (wedding.setupStatus !== "complete") redirect("/wedding/setup");
  let events;
  try {
    events = await listCeremonies(actor);
  } catch {
    events = null;
  }
  return (
    <WeddingFrame email={actor.account.email}>
      <a className="skip-link" href="#ceremonies-content">
        Skip to ceremonies
      </a>
      <main className={styles.main} id="ceremonies-content">
        <Link className={styles.back} href="/workspace">
          ← Back to dashboard
        </Link>
        <p className={styles.couple}>
          {wedding.groomName} &amp; {wedding.brideName}
        </p>
        <h1>Manage your ceremonies</h1>
        <p className={styles.lead}>
          Configure ceremony dates, times, and venues. Keep incomplete plans as
          drafts until you’re ready.
        </p>
        <div className={styles.notice}>
          Publishing marks a ceremony ready for future guest invitations. It
          does not send invitations.
        </div>
        {events ? (
          <CeremonyList events={events} initialDeleted={deleted} />
        ) : (
          <div className={styles.empty} role="alert">
            <h2>Unable to load ceremonies</h2>
            <p>
              Please try again. Your saved ceremonies have not been changed.
            </p>
            <RetryCeremonies />
          </div>
        )}
      </main>
    </WeddingFrame>
  );
}
