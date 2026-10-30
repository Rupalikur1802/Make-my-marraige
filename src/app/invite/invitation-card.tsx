import type { GuestInvitation } from "@/modules/invitations/validation";
import { ceremonyTiming } from "@/modules/events/validation";
import styles from "./invitation.module.css";
export function InvitationCard({
  invitation,
  showCeremonies = true,
}: {
  invitation: GuestInvitation;
  showCeremonies?: boolean;
}) {
  const { wedding, family, events } = invitation;
  return (
    <article className={styles.card}>
      <p className={styles.brand}>
        Make My Marriage · An invitation to celebrate
      </p>
      <h1>
        {wedding.groomName}
        <br />
        &amp; {wedding.brideName}
      </h1>
      <div className={styles.greeting}>
        <h2>Dear {family.name},</h2>
        <p>We would love to celebrate with you.</p>
        <p>Wedding date: {wedding.weddingDate} · IST</p>
        <p>
          {family.invitedCount} invited{" "}
          {family.invitedCount === 1 ? "member" : "members"}
        </p>
      </div>
      {showCeremonies && (
        <>
          <h2>Your ceremonies</h2>
          {events.length ? (
            <ul className={styles.events}>
              {events.map((e) => (
                <li key={e.id} className={styles.event}>
                  <h3>{e.name}</h3>
                  <p>{ceremonyTiming(e.startsAt)}</p>
                  <p>{e.venue}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No ceremonies are currently available. Please contact the couple
              for an update.
            </p>
          )}
        </>
      )}
      <p className={styles.notice}>
        This invitation link is private to your family. Keep it with the
        intended recipients.
      </p>
    </article>
  );
}
