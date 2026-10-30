import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { getWedding } from "@/modules/wedding/service.server";
import { WeddingUnavailable } from "@/app/wedding/setup/shared";
import styles from "./families.module.css";
import { WeddingFrame } from "@/app/workspace/frame";
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
    <WeddingFrame email={actor.account.email}>
      <a className="skip-link" href="#family-content">
        Skip to families
      </a>
      <main className={styles.main} id="family-content">
        {children}
      </main>
    </WeddingFrame>
  );
}
