import Image from "next/image";
import styles from "./home.module.css";
import type { ReactNode } from "react";

const ceremonies = [
  {
    day: "08",
    name: "Haldi & Phoolon Ka Snan",
    place: "Poolside Lawns · 10:30 AM",
    note: "Traditional yellow dress code",
  },
  {
    day: "09",
    name: "Sangeet & Cocktails",
    place: "Grand Ballroom · 7:00 PM",
    note: "An evening of music and celebration",
  },
  {
    day: "10",
    name: "Wedding Ceremony",
    place: "Courtyard Mandap · 9:30 AM",
    note: "Baraat arrival · 8:30 AM",
  },
  {
    day: "11",
    name: "Evening Reception",
    place: "The Glass House · 7:30 PM",
    note: "Dinner, dancing, and a little more celebrating",
  },
];
type IconName =
  | "calendar"
  | "check"
  | "wallet"
  | "pin"
  | "video"
  | "photos"
  | "link"
  | "eye"
  | "unlock"
  | "arrow"
  | "mail";
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="16" rx="2" />
        <path d="M8 3v4m8-4v4M4 11h16m-12 4h3m2 0h3" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    wallet: (
      <>
        <path d="M20 8H5a2 2 0 0 1 0-4h13v4M4 6v13h16V8m0 5h-5v4h5" />
        <path d="M17 15h.01" />
      </>
    ),
    pin: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),
    photos: (
      <>
        <rect x="6" y="3" width="15" height="15" rx="2" />
        <path d="M3 7v14h14m-11-8 4-4 7 8m-1-10h.01" />
      </>
    ),
    link: (
      <>
        <path d="m9 15 6-6m-6 9-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m-2 8a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    unlock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V6a4 4 0 0 1 8 0m-4 8v3" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function Brand() {
  return (
    <a className="brand" href="#top" aria-label="Make My Marriage home">
      <span>Make My Marriage</span>
    </a>
  );
}
function Navigation() {
  return (
    <>
      <a href="#planning">Planning</a>
      <a href="#guest-experience">Guest experience</a>
      <a href="/login">Couple login</a>
    </>
  );
}
function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children && <p className="section-description">{children}</p>}
    </div>
  );
}
export default function HomePage() {
  return (
    <div className={styles.home}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header" id="top">
        <div className="container header-inner">
          <Brand />
          <nav aria-label="Main navigation">
            <Navigation />
          </nav>
        </div>
      </header>
      <main id="main">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Your wedding, thoughtfully organized</p>
            <h1 id="hero-title">
              Beautiful
              <br />
              celebrations.
              <br />
              <em>Thoughtfully planned.</em>
            </h1>
            <p className="hero-description">
              Bring your ceremonies, family invitations, tasks, and spending
              into one thoughtful space—so you can enjoy the moments that
              matter.
            </p>
            <div className="hero-actions">
              <a className="button" href="#planning">
                Explore the planner
              </a>
              <a className="text-link" href="/login">
                Couple login <Icon name="arrow" />
              </a>
            </div>
            <div className="scope">
              <span className="eyebrow">Scope</span>
              <p>
                Events <span>/</span> Families <span>/</span> Tasks{" "}
                <span>/</span> Spending
              </p>
            </div>
          </div>
          <div className="hero-visual">
            <Image
              className="hero-image"
              src="/images/home-ceremony.jpg"
              alt="An Indian couple joining hands above ceremonial offerings during their wedding"
              width={1200}
              height={900}
              priority
              sizes="(max-width: 760px) 100vw, 50vw"
            />
            <div className="snapshot surface">
              <div className="snapshot-heading">
                <h2>Your wedding, at a glance</h2>
                <span className="sample-label">Sample preview</span>
              </div>
              <div className="snapshot-row">
                <span>Sangeet Night</span>
                <span>9 December</span>
              </div>
              <div className="snapshot-row">
                <span>Wedding Ceremony</span>
                <span>10 December</span>
              </div>
              <div className="snapshot-row snapshot-divider">
                <span>Wedding RSVP</span>
                <strong>124 attending</strong>
              </div>
            </div>
          </div>
        </section>
        <section
          className="section planning-section"
          id="planning"
          aria-labelledby="planning-title"
        >
          <div className="container">
            <div id="planning-title">
              <SectionHeading
                eyebrow="Centralized logistics"
                title="A clear view of every celebration."
              >
                Keep upcoming ceremonies, responsibilities, and spending
                together, with a simple overview of what needs your attention.
              </SectionHeading>
            </div>
            <div
              className="planner surface"
              aria-label="Illustrative wedding planning ledger"
            >
              <div className="planner-header">
                <div className="ledger-couple">
                  <h3>Arjun &amp; Priya</h3>
                  <span>10 December 2026 · Bengaluru</span>
                </div>
                <span className="sample-label">Sample preview ledger</span>
              </div>
              <div className="planner-grid">
                <div>
                  <div className="ledger-heading">
                    <h3>Ceremonial schedule</h3>
                    <span>4 events · IST</span>
                  </div>
                  <div className="ledger-events">
                    {ceremonies.map((event) => (
                      <div
                        className={
                          "ledger-event " +
                          (event.day === "10" ? "priority-event" : "")
                        }
                        key={event.day}
                      >
                        <span className="ledger-date">{event.day} Dec</span>
                        <div>
                          <h4>{event.name}</h4>
                          <p>{event.place}</p>
                        </div>
                        <span className="sample-label">
                          {event.day === "10"
                            ? "Main ceremony"
                            : "Sample event"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ledger-sidebar">
                  <div>
                    <div className="ledger-heading">
                      <h3>Key tasks</h3>
                      <span>3 pending · 1 complete</span>
                    </div>
                    <ul className="ledger-tasks">
                      <li>
                        <span>Coordinate dhol entry &amp; umbrellas</span>
                        <span>Kabir</span>
                      </li>
                      <li>
                        <span>Finalize bridal mehndi artist slot</span>
                        <span>Priya</span>
                      </li>
                      <li>
                        <span>Seating layout for elders in mandap</span>
                        <span>Arjun</span>
                      </li>
                      <li className="done">
                        <span>Confirm high-tea catering menu</span>
                        <span>Done</span>
                      </li>
                    </ul>
                  </div>
                  <div className="ledger-spending">
                    <div className="ledger-heading">
                      <h3>Spending total</h3>
                      <strong>₹1,25,000</strong>
                    </div>
                    <p>
                      Sample contributions recorded by Arjun (₹70,000) and Priya
                      (₹55,000).
                    </p>
                    <div
                      className="spending-bar"
                      aria-label="Arjun 56 percent, Priya 44 percent"
                    >
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="pillars">
              <div>
                <h3>
                  <Icon name="calendar" />
                  Every ceremony in order
                </h3>
                <p>
                  A single chronological schedule across your celebrations,
                  locations, and timings.
                </p>
              </div>
              <div>
                <h3>
                  <Icon name="check" />
                  Responsibilities made clear
                </h3>
                <p>
                  Keep ceremony preparations and the people responsible for them
                  together.
                </p>
              </div>
              <div>
                <h3>
                  <Icon name="wallet" />
                  Know who spent what
                </h3>
                <p>
                  Clear records of ceremonial and logistical expenses, grouped
                  by person or event.
                </p>
              </div>
            </div>
            <section className="essentials" aria-labelledby="essentials-title">
              <div className="essentials-heading">
                <div>
                  <p className="eyebrow">Ceremonial essentials</p>
                  <h3 id="essentials-title">
                    Thoughtful planning for traditional customs
                  </h3>
                </div>
                <p>
                  Illustrative ways to organize your events and tasks around the
                  customs that matter to your families.
                </p>
              </div>
              <div className="essentials-grid">
                <article className="surface">
                  <p className="eyebrow">Ceremony timing</p>
                  <h4>Muhurtham &amp; Auspicious Timings</h4>
                  <p>
                    Keep the timings recommended by your priest alongside your
                    ceremony schedule.
                  </p>
                  <div className="card-example">
                    <p>
                      <span>Sample muhurtham</span>
                      <span>10:14–10:48 AM</span>
                    </p>
                    <p>
                      <span>Priest briefing</span>
                      <span>Sample task</span>
                    </p>
                  </div>
                </article>
                <article className="surface">
                  <p className="eyebrow">Wardrobe</p>
                  <h4>Attire &amp; Trousseau Preparations</h4>
                  <p>
                    Use preparation tasks for outfit trials, jewellery pairings,
                    and family coordination.
                  </p>
                  <div className="card-example">
                    <p>
                      <span>Outfit fitting</span>
                      <span>Sample task</span>
                    </p>
                    <p>
                      <span>Safas &amp; dupattas</span>
                      <span>To coordinate</span>
                    </p>
                  </div>
                </article>
                <article className="surface">
                  <p className="eyebrow">Hospitality</p>
                  <h4>Family &amp; Guest Coordination</h4>
                  <p>
                    Keep each family’s invited events and ceremony attendance
                    easy to follow.
                  </p>
                  <div className="card-example">
                    <p>
                      <span>Sharma family</span>
                      <span>5 invited</span>
                    </p>
                    <p>
                      <span>Wedding ceremony</span>
                      <span>4 attending</span>
                    </p>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </section>
        <section
          className="section container"
          id="guest-experience"
          aria-labelledby="guest-title"
        >
          <div id="guest-title">
            <SectionHeading
              eyebrow="Thoughtful guest hospitality"
              title="Every family, personally invited."
            >
              Invite each family to the right events and collect attendance for
              every ceremony—without asking guests to create an account.
            </SectionHeading>
          </div>
          <div className="guest-grid">
            <div className="invitation surface">
              <div className="invitation-heading">
                <span className="sample-label">Sample family invitation</span>
                <span className="small-muted">Up to 5 guests</span>
              </div>
              <p className="eyebrow invitation-intro">Specially prepared for</p>
              <h3>The Sharma Family</h3>
              <p className="couple-signature">Arjun &amp; Priya</p>
              <p className="invitation-message">
                With the blessings of our elders, you’re invited to celebrate
                with us as we begin this sacred journey of companionship.
              </p>
              <div className="invited-events">
                <div>
                  <span>Wedding Ceremony</span>
                  <span>10 Dec 2026</span>
                </div>
                <div>
                  <span>Evening Reception</span>
                  <span>11 Dec 2026</span>
                </div>
              </div>
            </div>
            <div>
              <div className="attendance-preview">
                <div className="ledger-heading">
                  <h3>Confirm Attendance</h3>
                  <span>Up to 5 guests</span>
                </div>
                <div className="attendance-row">
                  <span>Wedding Ceremony</span>
                  <strong>4 guests attending</strong>
                </div>
                <div className="attendance-row">
                  <span>Evening Reception</span>
                  <strong>3 guests attending</strong>
                </div>
                <div className="attendance-footer">
                  <span>Illustrative response</span>
                  <span className="preview-response">Read-only preview</span>
                </div>
              </div>
              <div className="guest-benefits">
                <div>
                  <Icon name="link" />
                  <div>
                    <strong>One personal link</strong>
                    <p>A personal invitation link, shared by email.</p>
                  </div>
                </div>
                <div>
                  <Icon name="eye" />
                  <div>
                    <strong>Only invited events</strong>
                    <p>A schedule personal to each family.</p>
                  </div>
                </div>
                <div>
                  <Icon name="unlock" />
                  <div>
                    <strong>RSVP without account</strong>
                    <p>No passwords or app downloads.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section
          className="section details-section"
          aria-labelledby="details-title"
        >
          <div className="container">
            <div className="center-heading" id="details-title">
              <SectionHeading
                eyebrow="Harmonious coordination"
                title="The details that bring everyone together."
              />
            </div>
            <div className="essentials-grid details-grid">
              <article className="surface">
                <p className="eyebrow">Navigation</p>
                <h3>Find every venue</h3>
                <p>
                  Keep event addresses and Google Maps directions close at hand.
                </p>
                <div className="detail-example">
                  <strong>The Tamarind Tree, Bengaluru</strong>
                  <span>Sample location · Courtyard Mandap</span>
                </div>
              </article>
              <article className="surface">
                <p className="eyebrow">Broadcast</p>
                <h3>Join from wherever you are</h3>
                <p>
                  Share a YouTube livestream so loved ones can watch the
                  celebration.
                </p>
                <div className="detail-example">
                  <strong>Arjun &amp; Priya’s ceremony</strong>
                  <span>Sample livestream · 9:30 AM IST</span>
                </div>
              </article>
              <article className="surface">
                <p className="eyebrow">Memories</p>
                <h3>Keep memories together</h3>
                <p>
                  Give guests one shared wedding gallery to view and add wedding
                  photos.
                </p>
                <div className="detail-example">
                  <strong>Arjun &amp; Priya’s wedding album</strong>
                  <span>Sample photos · Access managed by the couple</span>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section
          className="section container"
          id="couple-login"
          aria-labelledby="closing-title"
        >
          <div className="closing">
            <p className="eyebrow">Quiet simplicity</p>
            <h2 id="closing-title">
              Make room for the
              <br />
              moments that matter.
            </h2>
            <p>A thoughtful space for the planning behind your celebration.</p>
            <a className="button" href="/login">
              Couple login
            </a>
            <a className="back-to-top" href="#top">
              ↑ Back to top
            </a>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <Brand />
            <p>Beautiful celebrations. Thoughtfully planned.</p>
          </div>
          <nav aria-label="Footer navigation">
            <Navigation />
          </nav>
        </div>
      </footer>
    </div>
  );
}
