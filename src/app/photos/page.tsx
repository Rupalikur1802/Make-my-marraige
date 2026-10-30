import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageCouple } from "@/modules/wedding/page-actor.server";
import { WeddingUnavailable } from "@/app/wedding/setup/shared";
import { WeddingFrame } from "@/app/workspace/frame";
import { listPhotos } from "@/modules/photos/service.server";
import { AuthError } from "@/modules/auth/errors";
import { PhotoGallery } from "./gallery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Wedding photos | Make My Marriage",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function PhotosPage() {
  const actor = await pageCouple();
  if (!actor) return <WeddingUnavailable />;
  let initial,
    initialError = "",
    initialCode = "";
  try {
    initial = await listPhotos({ kind: "couple", actor });
  } catch (e) {
    if (e instanceof AuthError && e.code === "SETUP_REQUIRED")
      redirect("/wedding/setup");
    initialError =
      e instanceof AuthError
        ? e.message
        : "Photos are temporarily unavailable. Please try again later.";
    initialCode = e instanceof AuthError ? e.code : "SERVICE_UNAVAILABLE";
  }
  return (
    <WeddingFrame email={actor.account.email}>
      <main>
        <PhotoGallery
          initial={initial}
          initialError={initialError}
          initialCode={initialCode}
        />
      </main>
    </WeddingFrame>
  );
}
