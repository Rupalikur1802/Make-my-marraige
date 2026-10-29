import { pageCouple } from "@/modules/wedding/page-actor.server";
import { listCeremonies } from "@/modules/events/service.server";
import { FamilyEditor } from "../editor";
import { RetryFamilies } from "../retry";
export default async function NewFamilyPage() {
  const actor = await pageCouple();
  if (!actor) return null;
  let events;
  try {
    events = await listCeremonies(actor);
  } catch {
    return (
      <div role="alert">
        <h1>Unable to load ceremonies</h1>
        <p>Try again before adding a family.</p>
        <RetryFamilies />
      </div>
    );
  }
  return <FamilyEditor initialEvents={events} />;
}
