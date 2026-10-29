import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { getWedding } from "@/modules/wedding/service.server";
import {
  WeddingHeader,
  WeddingFooter,
  WeddingUnavailable,
} from "@/app/wedding/setup/shared";
import styles from "./families.module.css";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Families | Make My Marriage",
  robots: { index: false, follow: false },
};
export default async function FamiliesLayout({
  children,
}: {
  children: React.ReactNode;
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
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#family-content">
        Skip to families
      </a>
      <WeddingHeader email={actor.account.email} />
      <main className={styles.main} id="family-content">
        <nav className={styles.nav} aria-label="Wedding management">
          <Link href="/workspace">← Wedding overview</Link>
          <Link href="/ceremonies">Ceremonies</Link>
          <Link href="/families">Families</Link>
        </nav>
        {children}
      </main>
      <WeddingFooter />
    </div>
  );
}
