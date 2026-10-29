import { notFound } from "next/navigation";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { invitationManagement } from "@/modules/invitations/service.server";
import { AuthError } from "@/modules/auth/errors";
import { InvitationManager } from "./manager";
import { RetryFamilies } from "../../retry";
export default async function ManageInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageCouple();
  if (!actor) return null;
  let data;
  try {
    data = await invitationManagement(actor, (await params).id);
  } catch (error) {
    if (error instanceof AuthError && error.status === 404) notFound();
    return (
      <section role="alert">
        <h1>Invitations are temporarily unavailable</h1>
        <p>
          Your saved family has not been changed. Try loading the page again.
        </p>
        <RetryFamilies />
      </section>
    );
  }
  return <InvitationManager initial={data} />;
}
