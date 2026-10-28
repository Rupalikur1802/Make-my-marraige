import Image from "next/image";
import Link from "next/link";
import { SignOut } from "@/app/workspace/sign-out";
import styles from "./setup.module.css";
export function WeddingHeader({ email }: { email: string }) {
  return (
    <header className={styles.header}>
      <Link href="/" className="brand">
        <Image src="/images/brand-emblem.png" alt="" width={36} height={36} />
        <span>Make My Marriage</span>
      </Link>
      <div className={styles.account}>
        <Link href="/">← Back to home</Link>
        <span>
          Signed in as <strong>{email}</strong>
        </span>
        <SignOut />
      </div>
    </header>
  );
}
export function WeddingFooter() {
  return (
    <footer className={styles.footer}>
      <span>Make My Marriage</span>
      <p>Beautiful celebrations. Thoughtfully planned.</p>
    </footer>
  );
}
export function WeddingUnavailable() {
  return (
    <main className="section container">
      <h1 style={{ fontSize: "2.5rem" }}>
        Your wedding is temporarily unavailable.
      </h1>
      <p>
        Please refresh to try again. Your saved details have not been changed.
      </p>
      <Link href="/login">Back to sign in</Link>
    </main>
  );
}
