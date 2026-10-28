import Image from "next/image";
import type { Metadata } from "next";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { getWedding } from "@/modules/wedding/service.server";
import { WeddingHeader, WeddingFooter, WeddingUnavailable } from "./shared";
import { SetupForm } from "./setup-form";
import styles from "./setup.module.css";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Wedding setup | Make My Marriage",
  robots: { index: false, follow: false },
};
export default async function WeddingSetupPage() {
  // Keep framework redirects outside the database failure handler.
  const actor = await pageCouple();
  if (!actor) return <WeddingUnavailable />;
  let wedding;
  try {
    wedding = await getWedding(actor);
  } catch {
    return <WeddingUnavailable />;
  }
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#setup-content">
        Skip to wedding setup
      </a>
      <WeddingHeader email={actor.account.email} />
      <main className={styles.main} id="setup-content">
        <div className={styles.intro}>
          <p className={styles.pill}>The wedding atelier · Your celebration</p>
          <h1>
            {wedding.setupStatus === "complete"
              ? "The details behind your celebration."
              : "Let’s start with your celebration."}
          </h1>
          <p>
            Add the essentials now. There’s room to refine the details as your
            plans come together.
          </p>
        </div>
        <div className={styles.setupGrid}>
          <aside className={styles.editorial}>
            <div className={styles.imagePanel}>
              <Image
                src="/images/wedding-setup.jpg"
                alt="An Indian couple seated under an ivory and marigold wedding mandap"
                width={1200}
                height={896}
                priority
                sizes="(max-width: 900px) 100vw, 40vw"
              />
              <div>
                <p>Heritage celebrations</p>
                <h2>The splendour of your traditions.</h2>
                <span>
                  A thoughtful beginning for the ceremonies and people that
                  matter.
                </span>
              </div>
            </div>
            <div className={styles.editorialNotes}>
              <p>
                <strong>Save at your pace</strong>Resume your saved draft from
                another signed-in device.
              </p>
              <p>
                <strong>A shared beginning</strong>Six draft ceremonies are
                added when you complete setup.
              </p>
            </div>
          </aside>
          <SetupForm initial={wedding} />
        </div>
      </main>
      <WeddingFooter />
    </div>
  );
}
