import Image from "next/image";
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
      <Image src="/images/brand-emblem.png" alt="" width={36} height={36} />
      <span>Make My Marriage</span>
    </a>
  );
}
function Navigation() {
  return (
    <>
      <a href="#planning">Planning</a>
      <a href="#guest-experience">Guest experience</a>
      <a href="#couple-login">Couple login</a>
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
    <>
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
              <a className="text-link" href="#couple-login">
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
              src="/images/wedding-ceremony.jpg"
              alt="An Indian couple taking part in a wedding ritual, with their hands joined above ceremonial offerings"
              width={1200}
              height={900}
              priority
              sizes="(max-width: 760px) 100vw, 50vw"
            />
            <div className="snapshot surface">
              <div className="snapshot-heading">
                <div>
                  <p className="eyebrow">Timeline & status</p>
                  <h2>Your wedding, at a glance</h2>
                </div>
                <span className="badge">Sample wedding</span>
              </div>
              <div className="snapshot-row">
                <span>
                  <i className="dot bronze" />
                  Sangeet Night
                </span>
                <span>9 December</span>
              </div>
              <div className="snapshot-row">
                <span>
                  <i className="dot" />
                  Wedding Ceremony
                </span>
                <span>10 December</span>
              </div>
              <div className="snapshot-row snapshot-divider">
                <span>
                  <Icon name="calendar" />
                  Ceremony timings
                </span>
                <span className="badge neutral">All in one place</span>
              </div>
              <div className="snapshot-row">
                <span>
                  <Icon name="check" />
                  Wedding RSVPs
                </span>
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
              aria-label="Sample wedding planning preview"
            >
              <div className="planner-header">
                <div className="couple-identity">
                  <span className="monogram">A&P</span>
                  <div>
                    <div className="couple-name">
                      <strong>Arjun & Priya</strong>
                      <span className="small-label">
                        Wedding date: 10 December 2026
                      </span>
                    </div>
                    <p>Bengaluru & Coorg celebrations</p>
                  </div>
                </div>
                <span className="badge neutral">
                  Sample wedding preview <i className="dot" />
                </span>
              </div>
              <div className="planner-grid">
                <div>
                  <div className="panel-heading">
                    <h3>Upcoming ceremonies</h3>
                    <span className="small-label">4 events · IST</span>
                  </div>
                  <div className="ceremony-list">
                    {ceremonies.map((event) => (
                      <div
                        className={`ceremony ${event.day === "10" ? "ceremony-highlight" : ""}`}
                        key={event.day}
                      >
                        <div className="date-tile">
                          <span>Dec</span>
                          <strong>{event.day}</strong>
                        </div>
                        <div>
                          <h4>{event.name}</h4>
                          <p>{event.place}</p>
                          <span className="event-note">{event.note}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="planning-sidebar">
                  <div className="task-panel">
                    <div className="panel-heading">
                      <h3>Preparation tasks</h3>
                      <span className="small-label">
                        3 pending · 1 complete
                      </span>
                    </div>
                    <ul className="task-list">
                      <li>
                        <span className="task-circle" />
                        <div>
                          Coordinate floral entry & umbrellas
                          <small>Assigned to: Rohan</small>
                        </div>
                      </li>
                      <li>
                        <span className="task-circle" />
                        <div>
                          Finalize mehendi artist arrival slot
                          <small>Assigned to: Priya</small>
                        </div>
                      </li>
                      <li>
                        <span className="task-circle" />
                        <div>
                          Seating for elders in the front rows
                          <small>Assigned to: Arjun</small>
                        </div>
                      </li>
                      <li className="task-complete">
                        <Icon name="check" />
                        <span>Confirm guest welcome hampers</span>
                      </li>
                    </ul>
                  </div>
                  <div className="expense-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Spending</p>
                        <h3 className="expense-total">₹1,25,000</h3>
                      </div>
                      <span className="small-label">Recorded expenses</span>
                    </div>
                    <p>
                      Keep ceremony preparations and everyday details accounted
                      for.
                    </p>
                    <div className="spending-rule">
                      <span />
                    </div>
                    <div className="payer-grid">
                      <div>
                        <span className="small-label">
                          <i className="dot" /> Arjun
                        </span>
                        <strong>₹70,000</strong>
                        <small>Venue deposit & guest lounge</small>
                      </div>
                      <div>
                        <span className="small-label">
                          <i className="dot bronze" /> Priya
                        </span>
                        <strong>₹55,000</strong>
                        <small>Flowers, mandap & sweets</small>
                      </div>
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
                  A single chronological schedule for your celebrations,
                  locations, and timings.
                </p>
              </div>
              <div>
                <h3>
                  <Icon name="check" />
                  Responsibilities made clear
                </h3>
                <p>
                  Keep tasks and the people responsible for them together, so
                  nothing gets lost.
                </p>
              </div>
              <div>
                <h3>
                  <Icon name="wallet" />
                  Know who spent what
                </h3>
                <p>
                  A clear record of spending, grouped by person or event. A
                  little less guesswork.
                </p>
              </div>
            </div>
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
                <div>
                  <p className="eyebrow">Ceremonial invitation</p>
                  <span className="small-muted">Sample family invitation</span>
                </div>
                <Icon name="mail" />
              </div>
              <p className="eyebrow invitation-intro">Specially prepared for</p>
              <h3>For the Sharma Family</h3>
              <p className="couple-signature">Arjun & Priya</p>
              <p className="invitation-message">
                With the blessings of our elders, you’re invited to celebrate
                with us as we begin this beautiful journey together.
              </p>
              <div className="invited-events">
                <p className="small-label">Events for your family</p>
                <div>
                  <span>Wedding Ceremony</span>
                  <span>10 December 2026</span>
                </div>
                <div>
                  <span>Evening Reception</span>
                  <span>11 December 2026</span>
                </div>
              </div>
              <div className="invitation-footer">
                <span className="small-label">
                  Invited members: up to 5 guests
                </span>
                <span className="small-label accent">
                  <Icon name="link" /> Family invitation
                </span>
              </div>
            </div>
            <div className="rsvp-column">
              <div className="rsvp-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Sample RSVP</p>
                    <h3>Confirm ceremony attendance</h3>
                  </div>
                  <span className="badge neutral">
                    Sharma family · 5 guests
                  </span>
                </div>
                <div className="rsvp-row">
                  <div>
                    <h4>Wedding Ceremony</h4>
                    <p>Thursday, 10 Dec · 9:30 AM</p>
                  </div>
                  <span className="guest-count">
                    4 guests <Icon name="check" />
                  </span>
                </div>
                <div className="rsvp-row">
                  <div>
                    <h4>Evening Reception</h4>
                    <p>Friday, 11 Dec · 7:30 PM</p>
                  </div>
                  <span className="guest-count">
                    3 guests <Icon name="check" />
                  </span>
                </div>
                <div className="rsvp-footer">
                  <span>Illustrative response</span>
                  <span className="response-status">
                    <Icon name="check" /> Attending
                  </span>
                </div>
              </div>
              <div className="guest-benefits">
                <div>
                  <Icon name="link" />
                  <div>
                    <strong>One personal link</strong>
                    <p>Shared manually through WhatsApp.</p>
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
                    <strong>No guest account</strong>
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
            <div className="feature-grid">
              <article className="feature-card surface">
                <div className="feature-icon">
                  <Icon name="pin" />
                </div>
                <h3>Find every venue</h3>
                <p>
                  Keep event addresses and Google Maps directions close at hand.
                </p>
                <div className="feature-example">
                  <p className="eyebrow">Sample location</p>
                  <h4>The Tamarind Tree, Bengaluru</h4>
                  <p>Courtyard Mandap · Wedding ceremony</p>
                  <div className="example-footer">
                    Directions, without the detour <Icon name="arrow" />
                  </div>
                </div>
              </article>
              <article className="feature-card surface">
                <div className="feature-icon">
                  <Icon name="video" />
                </div>
                <h3>Join from wherever you are</h3>
                <p>
                  Share a YouTube livestream so loved ones can watch the
                  celebration.
                </p>
                <div
                  className="video-example"
                  aria-label="Illustrative livestream preview, not a playable video"
                >
                  <div className="video-still">
                    <span className="play-symbol" aria-hidden="true">
                      ▶
                    </span>
                    <span className="small-label">
                      YouTube livestream preview
                    </span>
                  </div>
                  <div className="video-caption">
                    <span>Arjun & Priya’s ceremony</span>
                    <span>9:30 AM IST</span>
                  </div>
                </div>
              </article>
              <article className="feature-card surface">
                <div className="feature-icon">
                  <Icon name="photos" />
                </div>
                <h3>Keep the memories together</h3>
                <p>
                  Give guests one shared OneDrive folder to view and add wedding
                  photos.
                </p>
                <div className="feature-example">
                  <div className="album-heading">
                    <Icon name="photos" />
                    <div>
                      <h4>Arjun & Priya’s wedding album</h4>
                      <p>Shared OneDrive folder</p>
                    </div>
                  </div>
                  <p className="photo-instruction">
                    Please upload wedding photos in JPEG format.
                  </p>
                  <p className="small-muted">
                    Folder access and uploads are managed in OneDrive.
                  </p>
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
            <button
              className="button"
              disabled
              aria-describedby="login-availability"
            >
              Couple login
            </button>
            <p id="login-availability" className="small-muted">
              Couple sign-in is coming soon.
            </p>
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
    </>
  );
}
