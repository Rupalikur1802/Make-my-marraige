import type { Metadata } from "next";
import { InvitationEntry } from "./entry";
export const metadata: Metadata = {
  title: "Open your invitation | Make My Marriage",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function InvitePage() {
  return <InvitationEntry />;
}
