import { cookies } from "next/headers";
import type { Metadata } from "next";
import { guestInvitation } from "@/modules/invitations/service.server";
import { guestCookie } from "@/modules/invitations/http.server";
import { AuthError } from "@/modules/auth/errors";
import { InvitationCard } from "@/app/invite/invitation-card";
import { GuestActions } from "./guest-actions";
import styles from "@/app/invite/invitation.module.css";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your family invitation | Make My Marriage",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function GuestPage() {
  let invitation,
    message = "",
    retry = false;
  try {
    invitation = await guestInvitation(
      (await cookies()).get(guestCookie().name)?.value,
    );
  } catch (error) {
    message =
      error instanceof AuthError
        ? error.message
        : "Your invitation could not be loaded. Please retry.";
    retry = !(error instanceof AuthError);
  }
  return (
    <main className={styles.page}>
      {invitation ? (
        <>
          <InvitationCard invitation={invitation} />
          <div className={styles.card}>
            <GuestActions />
          </div>
        </>
      ) : (
        <section className={styles.card}>
          <h1>Invitation unavailable</h1>
          <p role="alert">{message}</p>
          <p>
            Reopen the current invitation link from your email, or contact the
            couple for help.
          </p>
          {retry && <GuestActions retryOnly />}
        </section>
      )}
    </main>
  );
}
