import "server-only";
import { isIP } from "node:net";
import { z } from "zod";
import { appOrigin } from "@/lib/config.server";
import { ceremonyTiming } from "@/modules/events/validation";
import type { EmailPreview } from "./validation";
export function deliverySettings() {
  const sender = z.email().max(254).safeParse(process.env.EMAIL_FROM);
  const origin = appOrigin();
  const host = new URL(origin).hostname.replace(/^\[|\]$/g, "");
  const publicOrigin =
    origin.startsWith("https://") &&
    !isIP(host) &&
    host !== "localhost" &&
    !host.endsWith(".localhost") &&
    !host.endsWith(".local");
  return {
    sender: sender.success ? sender.data : null,
    origin,
    available:
      process.env.INVITATION_EMAIL_ENABLED === "true" &&
      !!process.env.RESEND_API_KEY &&
      sender.success &&
      publicOrigin,
  };
}
export function invitationUrl(origin: string, token: string) {
  return origin + "/invite#token=" + token;
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function emailContent(preview: EmailPreview, url: string) {
  const { wedding, family, events } = preview.invitation;
  const lines = [
    `Dear ${family.name},`,
    "",
    `We would love to celebrate with you at ${wedding.groomName} & ${wedding.brideName}'s wedding.`,
    `Wedding date: ${wedding.weddingDate} (IST)`,
    `Invited members: ${family.invitedCount}`,
    "",
    ...events.map(
      (e) => `${e.name} — ${ceremonyTiming(e.startsAt)} — ${e.venue}`,
    ),
    "",
    `View your invitation: ${url}`,
    "This invitation link is private to your family.",
  ];
  const text = lines.join("\n");
  const html = `<div style="background:#f7f5ef;color:#252924;padding:32px;font-family:Georgia,serif;max-width:640px;margin:auto"><p>Make My Marriage</p><h1>${escapeHtml(wedding.groomName)} &amp; ${escapeHtml(wedding.brideName)}</h1>${lines
    .slice(0, -2)
    .map((line) => `<p style="line-height:1.6">${escapeHtml(line)}</p>`)
    .join(
      "",
    )}<p><a href="${escapeHtml(url)}" style="background:#465344;color:white;padding:14px 20px;display:inline-block">View your invitation</a></p><p>This invitation link is private to your family.</p></div>`;
  return { text, html };
}
export type EmailPayload = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
};
export type EmailTransport = (
  payload: EmailPayload,
  key: string,
) => Promise<
  { status: "accepted"; id: string } | { status: "failed" | "uncertain" }
>;
export const sendViaResend: EmailTransport = async (payload, key) => {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
    });
    if (response.ok) {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === "object" &&
        "id" in body &&
        typeof body.id === "string" &&
        body.id.length < 200
      )
        return { status: "accepted", id: body.id };
      return { status: "uncertain" };
    }
    // No provider response text (which may contain addresses or links) reaches logs/UI.
    return {
      status:
        response.status >= 500 || response.status === 409
          ? "uncertain"
          : "failed",
    };
  } catch {
    return { status: "uncertain" };
  }
};
