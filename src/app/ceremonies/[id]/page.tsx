import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { getWedding } from "@/modules/wedding/service.server";
import { getCeremony } from "@/modules/events/service.server";
import { AuthError } from "@/modules/auth/errors";
import {
  WeddingHeader,
  WeddingFooter,
  WeddingUnavailable,
} from "@/app/wedding/setup/shared";
import { RetryCeremonies } from "../retry";
import { CeremonyEditor } from "./editor";
import styles from "../ceremonies.module.css";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit ceremony | Make My Marriage",
  robots: { index: false, follow: false },
};
export default async function EditCeremonyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageCouple();
  if (!actor) return <WeddingUnavailable />;
  let wedding;
  try {
    wedding = await getWedding(actor);
  } catch {
    return <WeddingUnavailable />;
  }
  if (wedding.setupStatus !== "complete") redirect("/wedding/setup");
  let event,
    missing = false;
  try {
    event = await getCeremony(actor, (await params).id);
  } catch (error) {
    missing = error instanceof AuthError && error.status === 404;
  }
  if (missing) notFound();
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#editor-content">
        Skip to ceremony editor
      </a>
      <WeddingHeader email={actor.account.email} />
      <main className={styles.main} id="editor-content">
        {event ? (
          <CeremonyEditor initial={event} />
        ) : (
          <div className={styles.empty} role="alert">
            <h1>Unable to load this ceremony</h1>
            <p>Please retry or return to your saved ceremonies.</p>
            <RetryCeremonies />
            <Link href="/ceremonies">Back to ceremonies</Link>
          </div>
        )}
      </main>
      <WeddingFooter />
    </div>
  );
}
