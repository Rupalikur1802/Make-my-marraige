"use client";
import { useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SignOut } from "./sign-out";
import styles from "./frame.module.css";
const destinations = [
  {
    href: "/workspace",
    label: "Dashboard",
    icon: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  },
  {
    href: "/ceremonies",
    label: "Events",
    icon: "M4 5h16v16H4zM8 2v6M16 2v6M4 11h16",
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: "M4 6h2m4 0h10M4 12h2m4 0h10M4 18h2m4 0h10",
  },
  { href: "/expenses", label: "Expenses", icon: "M3 5h18v14H3zM16 10h5v5h-5z" },
  {
    href: "/families",
    label: "Guests",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  },
  {
    href: "/families?section=invitations",
    label: "Invitation",
    icon: "M3 5h18v14H3zM3 5l9 8 9-8",
  },
  {
    href: "/photos",
    label: "Photos",
    icon: "M3 5h18v14H3zM3 17l6-6 4 4 3-3 5 5M15 9h.01",
  },
  {
    href: "/wedding/setup",
    label: "Settings",
    icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  },
];
export function WeddingFrame({
  email,
  wedding,
  children,
}: {
  email: string;
  wedding?: {
    groomName: string;
    brideName: string;
    weddingDate: string;
    venue: string;
    daysUntilWedding: number;
  };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const current =
    pathname.includes("/invitation") ||
    (pathname === "/families" && params.get("section") === "invitations")
      ? "Invitation"
      : pathname.startsWith("/attendance")
        ? "Guests"
        : (destinations.find(
            (item) =>
              item.href &&
              !item.href.includes("?") &&
              (pathname === item.href || pathname.startsWith(item.href + "/")),
          )?.label ?? "Settings");
  function navigation() {
    return (
      <nav aria-label="Wedding management">
        {destinations.map((item) =>
          item.href ? (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => {
                if (mobileMenu.current) mobileMenu.current.open = false;
              }}
              aria-current={current === item.label ? "page" : undefined}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ) : (
            <span
              className={styles.comingSoon}
              key={item.label}
              aria-disabled="true"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d={item.icon} />
              </svg>
              <span>{item.label}</span>
              <small>Coming soon</small>
            </span>
          ),
        )}
      </nav>
    );
  }
  const brand = (
    <Link href="/workspace" className={styles.brand}>
      <Image src="/images/brand-emblem.png" alt="" width={38} height={38} />
      <span>
        Make My Marriage<small>Your wedding workspace</small>
      </span>
    </Link>
  );
  return (
    <div className={styles.frame}>
      <a className="skip-link" href="#workspace-page-content">
        Skip to page content
      </a>
      <aside className={styles.sidebar}>
        {brand}
        {wedding && (
          <div className={styles.weddingContext}>
            <strong>
              {wedding.groomName} <em>&amp;</em> {wedding.brideName}
            </strong>
            <span>{wedding.weddingDate} · IST</span>
            <span>{wedding.venue}</span>
          </div>
        )}
        <div className={styles.sideHeading}>Your celebration</div>
        {navigation()}
        <div className={styles.sideNote}>
          <span>Made for your meaningful moments.</span>
          <Link href="/">Visit public homepage ↗</Link>
        </div>
      </aside>
      <div className={styles.body}>
        <header className={styles.header}>
          <div className={styles.breadcrumb}>
            <span>Wedding workspace</span>
            <strong>{current}</strong>
          </div>
          <div className={styles.mobileBrand}>{brand}</div>
          <div className={styles.account}>
            <span>
              Shared couple account<strong>{email}</strong>
            </span>
            <SignOut />
          </div>
          <details className={styles.mobileMenu} ref={mobileMenu}>
            <summary>Menu</summary>
            {navigation()}
          </details>
        </header>
        <div
          className={styles.content}
          id="workspace-page-content"
          tabIndex={-1}
        >
          {children}
        </div>
        <footer className={styles.footer}>
          <span>Make My Marriage</span>
          <p>Beautiful celebrations. Thoughtfully planned.</p>
        </footer>
      </div>
    </div>
  );
}
