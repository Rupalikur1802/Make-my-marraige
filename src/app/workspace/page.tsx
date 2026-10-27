import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { coupleCookie } from "@/lib/config.server";
import { resolveCoupleSession } from "@/modules/auth/service.server";
import { SignOut } from "./sign-out";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your workspace | Make My Marriage",
  robots: { index: false, follow: false },
};
export default async function WorkspacePage() {
  const token = (await cookies()).get(coupleCookie().name)?.value;
  let session;
  try {
    session = await resolveCoupleSession(token);
  } catch {
    return (
      <main className="section container">
        <h1 style={{ fontSize: "2.5rem" }}>
          Your workspace is temporarily unavailable.
        </h1>
        <p style={{ marginBlock: "24px" }}>Please refresh to try again.</p>
        <Link href="/login" className="text-link">
          Back to sign in
        </Link>
      </main>
    );
  }
  if (!session) redirect("/login");
  return (
    <main className="section container">
      <p className="eyebrow">Your shared workspace</p>
      <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", marginBlock: "20px" }}>
        Welcome to Make My Marriage.
      </h1>
      <p>Signed in as {session.account.email}</p>
      <p style={{ marginBlock: "20px", maxWidth: "540px", lineHeight: 1.8 }}>
        Your shared account is ready. Wedding setup is the next step, where
        you’ll add the details of your celebration.
      </p>
      <SignOut />
      <p style={{ marginTop: "30px" }}>
        <Link href="/" className="text-link">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
