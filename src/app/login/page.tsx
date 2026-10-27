import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { LoginExperience } from "./login-experience";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Couple login | Make My Marriage",
  robots: { index: false, follow: false },
};
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const created = (await searchParams).created === "1";
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#login-content">
        Skip to sign in
      </a>
      <header className={styles.header}>
        <Link href="/" className="brand">
          <Image src="/images/brand-emblem.png" width={36} height={36} alt="" />
          <span>Make My Marriage</span>
        </Link>
        <div className={styles.headerActions}>
          <Link href="/">Back to home</Link>
          <span className={styles.avatar} aria-hidden="true">
            ♙
          </span>
        </div>
      </header>
      <LoginExperience created={created} />
      <footer className={styles.footer}>
        Make My Marriage{" "}
        <span>Beautiful celebrations. Thoughtfully planned.</span>
      </footer>
    </div>
  );
}
