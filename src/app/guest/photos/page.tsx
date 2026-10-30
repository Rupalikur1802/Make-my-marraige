import type { Metadata } from "next";
import { cookies } from "next/headers";
import { guestCookie } from "@/modules/invitations/http.server";
import { listPhotos } from "@/modules/photos/service.server";
import { AuthError } from "@/modules/auth/errors";
import { PhotoGallery } from "@/app/photos/gallery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Wedding memories | Make My Marriage",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function GuestPhotosPage() {
  let initial,
    initialError = "",
    initialCode = "";
  try {
    initial = await listPhotos({
      kind: "guest",
      token: (await cookies()).get(guestCookie().name)?.value,
    });
  } catch (e) {
    initialError =
      e instanceof AuthError
        ? e.message
        : "Photos are temporarily unavailable. Please try again later.";
    initialCode = e instanceof AuthError ? e.code : "SERVICE_UNAVAILABLE";
  }
  return (
    <main>
      <PhotoGallery
        guest
        initial={initial}
        initialError={initialError}
        initialCode={initialCode}
      />
    </main>
  );
}
