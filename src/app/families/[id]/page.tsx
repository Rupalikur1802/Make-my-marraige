import { notFound } from "next/navigation";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { listCeremonies } from "@/modules/events/service.server";
import { getFamily } from "@/modules/families/service.server";
import { AuthError } from "@/modules/auth/errors";
import { FamilyEditor } from "../editor";
import { RetryFamilies } from "../retry";
export default async function EditFamilyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageCouple();
  if (!actor) return null;
  let family, events;
  try {
    family = await getFamily(actor, (await params).id);
    events = await listCeremonies(actor);
  } catch (error) {
    if (error instanceof AuthError && error.status === 404) notFound();
    return (
      <div role="alert">
        <h1>Unable to load this family</h1>
        <p>Your saved details have not been changed.</p>
        <RetryFamilies />
      </div>
    );
  }
  return (
    <FamilyEditor key={family.id} initial={family} initialEvents={events} />
  );
}
