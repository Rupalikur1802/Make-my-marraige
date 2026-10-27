import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "../login/login-form";
import styles from "../login/login.module.css";

export const metadata: Metadata = {
  title: "Create account | Make My Marriage",
  robots: { index: false, follow: false },
};
export default function SignupPage() {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#login-content">
        Skip to create account
      </a>
      <header className={styles.header}>
        <Link href="/" className="brand">
          <Image src="/images/brand-emblem.png" width={36} height={36} alt="" />
          <span>Make My Marriage</span>
        </Link>
        <Link href="/">← Back to home</Link>
      </header>
      <main className={styles.canvas} id="login-content">
        <div className={styles.editorial}>
          <div className={styles.imageMat}>
            <Image
              src="/images/couple-login.jpg"
              alt="Hands joined during an intimate Indian wedding ceremony"
              width={1200}
              height={825}
              priority
              sizes="(max-width: 800px) 100vw, 55vw"
            />
          </div>
          <div className={styles.narrative}>
            <p className="eyebrow">Composed unions</p>
            <h1>
              Beautiful celebrations.
              <br />
              <em>Thoughtfully planned.</em>
            </h1>
            <p>
              Your ceremonies, families, tasks, and spending—all thoughtfully
              organized in one place.
            </p>
          </div>
        </div>
        <section className={styles.card} aria-labelledby="login-title">
          <p className="eyebrow">Couple workspace</p>
          <h2 id="login-title">Begin your celebration.</h2>
          <p className={styles.intro}>
            Create one shared account for you and your partner.
          </p>
          <LoginForm signup />
          <p className={styles.assistance}>
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
          <div className={styles.guestNote}>
            <p className="eyebrow">Attending as a guest?</p>
            <p>
              Guests don’t need an account. Open the family invitation link
              shared by the couple.
            </p>
          </div>
          <p className={styles.assistance}>
            You and your partner can sign in with your shared account.
          </p>
        </section>
      </main>
      <footer className={styles.footer}>
        Make My Marriage{" "}
        <span>Beautiful celebrations. Thoughtfully planned.</span>
      </footer>
    </div>
  );
}
