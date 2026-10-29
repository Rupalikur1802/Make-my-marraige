"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { invitationManagement } from "@/modules/invitations/service.server";
import type { EmailAttemptDTO } from "@/modules/invitations/validation";
import { InvitationCard } from "@/app/invite/invitation-card";
import { Confirm } from "../../confirm";
import styles from "../../families.module.css";
type Management = Awaited<ReturnType<typeof invitationManagement>>;
class InvitationRequestError extends Error {}
function linkToken(link: string, origin: string) {
  try {
    const url = new URL(link);
    if (
      url.pathname !== "/invite" ||
      url.origin !== origin ||
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    const token = new URLSearchParams(url.hash.slice(1)).get("token");
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}
export function InvitationManager({ initial }: { initial: Management }) {
  const [data, setData] = useState(initial),
    [link, setLink] = useState(""),
    [attempt, setAttempt] = useState<EmailAttemptDTO | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [expired, setExpired] = useState(false),
    [preview, setPreview] = useState(false),
    [confirm, setConfirm] = useState<"replace" | "resend" | "send" | null>(
      null,
    );
  const inFlight = useRef(false),
    requestKey = useRef<{ signature: string; key: string } | null>(null);
  const token = linkToken(link, data.origin),
    current = attempt ?? data.latest;
  const drafts = data.family.eventAssignments.filter(
    (e) => e.eventStatus === "draft",
  );
  const unresolved =
    !!data.latest && ["sending", "uncertain"].includes(data.latest.status);
  async function json(path: string, body?: unknown) {
    const response = await fetch("/api/families/" + data.family.id + path, {
      method: body === undefined ? "GET" : "POST",
      cache: "no-store",
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) setExpired(true);
      throw new InvitationRequestError(
        result.error?.message || "The invitation request failed. Please retry.",
      );
    }
    return result.data;
  }
  async function reload(clear = false) {
    const fresh = (await json("/invitation")) as Management;
    setData(fresh);
    if (clear) setAttempt(null);
    return fresh;
  }
  async function run(action: () => Promise<void>) {
    if (inFlight.current || expired) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The request failed. Please retry.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function generate(replace = false) {
    await run(async () => {
      const result = await json("/invitation-link", {
        expectedRevision: data.family.revision,
        replace,
      });
      setLink(result.invitationUrl);
      setAttempt(null);
      setConfirm(null);
      await reload();
      setMessage(
        "New private link generated. Copy it now; its complete value cannot be retrieved later.",
      );
    });
  }
  async function prepare(confirmed = false) {
    if (!token) return;
    if (
      data.latest &&
      ["accepted", "uncertain", "sending"].includes(data.latest.status) &&
      !confirmed
    ) {
      setConfirm("resend");
      return;
    }
    await run(async () => {
      const body = {
        expectedRevision: data.family.revision,
        token,
        confirmResend: confirmed,
        confirmUncertainResend: confirmed && unresolved,
      };
      const signature = JSON.stringify(body);
      if (requestKey.current?.signature !== signature)
        requestKey.current = { signature, key: crypto.randomUUID() };
      const result = (await json("/email-preview", {
        ...body,
        requestKey: requestKey.current.key,
      })) as EmailAttemptDTO;
      setAttempt(result);
      setConfirm(null);
      setPreview(true);
      await reload();
      setMessage("Email preview prepared. Nothing has been sent yet.");
    });
  }
  async function send() {
    if (!token || !current) return;
    await run(async () => {
      setConfirm(null);
      let result;
      try {
        result = await json("/email", { attemptId: current.id, token });
      } catch (e) {
        if (!(e instanceof InvitationRequestError))
          setAttempt({ ...current, status: "uncertain" });
        throw e;
      }
      await reload(true);
      setMessage(
        result.status === "accepted"
          ? "Invitation email accepted for sending. This does not confirm inbox delivery."
          : result.status === "failed"
            ? "The provider did not accept this email. Review the details and deliberately retry this same attempt."
            : "We could not confirm acceptance. Check the status, or retry this same attempt without creating a new email.",
      );
    });
  }
  const canSend =
    !!token &&
    !!current &&
    current.status !== "accepted" &&
    data.deliveryAvailable &&
    !expired;
  return (
    <div className={styles.editor}>
      <p className={styles.eyebrow}>Private family invitation</p>
      <h1>Manage invitation</h1>
      <h2>{data.family.name}</h2>
      <p>
        {data.family.invitedCount} invited members ·{" "}
        {data.family.email || "No email address saved"}
      </p>
      <Link href={"/families/" + data.family.id}>Edit family details</Link>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className={styles.success}>
          {message}
        </p>
      )}
      {expired && <Link href="/login">Sign in again</Link>}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          disabled={busy || expired}
          onClick={() =>
            void run(async () => {
              await reload(true);
              setMessage(
                "Latest invitation details loaded. Review them before continuing.",
              );
            })
          }
        >
          Load latest details / status
        </button>
      </div>
      <section className={styles.panel}>
        <h2>Family invitation link</h2>
        <p>
          {data.family.hasInvitationLink
            ? "A private invitation link exists. Paste your retained current link below, or explicitly replace it if it was lost."
            : "Generate a private link for this family. Share it only with the intended recipients."}
        </p>
        <p className={styles.notice}>
          Anyone holding this link can open this family’s invitation. The
          complete link is shown once and is kept only in this open page.
        </p>
        <button
          className={styles.primary}
          type="button"
          disabled={busy || expired}
          onClick={() =>
            data.family.hasInvitationLink
              ? setConfirm("replace")
              : void generate()
          }
        >
          {data.family.hasInvitationLink
            ? "Generate replacement link"
            : "Generate invitation link"}
        </button>
        <div className={styles.field} style={{ marginTop: 20 }}>
          <label htmlFor="current-invitation-link">
            Current private invitation link
          </label>
          <input
            id="current-invitation-link"
            type="url"
            autoComplete="off"
            spellCheck={false}
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setAttempt(null);
            }}
            placeholder="Paste a retained current invitation link"
            disabled={busy || expired}
          />
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={!token || busy}
            onClick={() =>
              void run(async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setMessage("Invitation link copied.");
                } catch {
                  setError(
                    "Clipboard access was unavailable. Select the link and copy it manually.",
                  );
                }
              })
            }
          >
            Copy link
          </button>
          <button
            className={styles.secondary}
            type="button"
            onClick={() => setPreview((v) => !v)}
          >
            {preview ? "Hide invitation preview" : "Preview invitation"}
          </button>
        </div>
      </section>
      {drafts.length > 0 && (
        <p className={styles.notice}>
          Assigned draft ceremonies are excluded from the guest invitation:{" "}
          {drafts.map((e) => e.eventName).join(", ")}.
        </p>
      )}
      {!data.invitation.events.length && (
        <p className={styles.notice}>
          No published ceremonies are assigned. Assign and publish a ceremony
          before preparing an email.
        </p>
      )}
      {!data.deliveryAvailable && (
        <p className={styles.notice}>
          Email sending is unavailable. You can still generate, copy and preview
          a link. Contact the app administrator to enable email invitations.
        </p>
      )}
      <section className={styles.panel}>
        <h2>Email invitation</h2>
        <p>
          Prepare a personalized email to this family’s saved address. Saving a
          family never sends automatically.
        </p>
        {!data.family.email && (
          <p>Add an invitation email in the family details first.</p>
        )}
        <button
          className={styles.primary}
          type="button"
          disabled={
            busy ||
            expired ||
            !token ||
            !data.family.email ||
            !data.invitation.events.length
          }
          onClick={() => void prepare()}
        >
          Prepare email invitation
        </button>
        {current && (
          <>
            <p className={styles.eyebrow} style={{ marginTop: 24 }}>
              Email attempt · {current.status}
            </p>
            <dl>
              <dt>To</dt>
              <dd>{current.preview.recipient}</dd>
              <dt>From</dt>
              <dd>{current.preview.sender || "Sender not configured"}</dd>
              <dt>Subject</dt>
              <dd>{current.preview.subject}</dd>
            </dl>
            <p>Dear {current.preview.invitation.family.name},</p>
            <p>
              We would love to celebrate with you. Open your invitation to view
              the ceremonies your family is invited to.
            </p>
            <p>
              This email is for this family only. Its private link opens the
              personalized invitation below.
            </p>
            {current.status === "accepted" ? (
              <p role="status" className={styles.success}>
                Accepted for sending. Inbox delivery has not been verified.
                Prepare another preview for a deliberate resend.
              </p>
            ) : (
              <>
                <p className={styles.muted}>
                  Retries reuse this attempt for up to 23 hours. A new send may
                  create another email; it never replaces the invitation link.
                </p>
                <button
                  className={styles.primary}
                  type="button"
                  disabled={busy || !canSend}
                  onClick={() => setConfirm("send")}
                >
                  {current.status === "ready"
                    ? "Review and send invitation"
                    : "Review and retry same email"}
                </button>
              </>
            )}
          </>
        )}
      </section>
      {preview && (
        <>
          <p className={styles.eyebrow}>
            Couple preview · Assigned published ceremonies only
          </p>
          <InvitationCard
            invitation={
              current?.status === "ready"
                ? current.preview.invitation
                : data.invitation
            }
          />
        </>
      )}
      {confirm === "replace" && (
        <Confirm
          title="Replace this family’s invitation link?"
          busy={busy}
          danger
          confirmLabel="Generate replacement link"
          cancelLabel="Keep existing link"
          onCancel={() => setConfirm(null)}
          onConfirm={() => void generate(true)}
        >
          <p>
            The previous link will stop working, and existing guest sessions
            will end. Share or email the new link so the family can reopen its
            invitation.
          </p>
          <p>
            No email is sent by this action. If generation cannot be confirmed,
            load the latest details before deciding whether to replace again.
          </p>
          {error && <p role="alert">{error}</p>}
        </Confirm>
      )}
      {confirm === "resend" && (
        <Confirm
          title={
            unresolved
              ? "Prepare another email despite uncertain status?"
              : "Prepare another invitation email?"
          }
          busy={busy}
          confirmLabel="Prepare another preview"
          onCancel={() => setConfirm(null)}
          onConfirm={() => void prepare(true)}
        >
          <p>
            This will prepare another email to{" "}
            <strong>{data.family.email}</strong>. Sending it requires a separate
            confirmation.
          </p>
          {unresolved && (
            <p>
              The previous email may already have been accepted. Check with the
              provider or recipient first. Continuing acknowledges that the next
              send could duplicate it. You can instead cancel and retry the
              existing attempt.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </Confirm>
      )}
      {confirm === "send" && current && (
        <Confirm
          title={
            current.status === "ready"
              ? "Send invitation email?"
              : "Retry this same invitation email?"
          }
          busy={busy}
          confirmDisabled={!canSend}
          confirmLabel="Confirm and send"
          onCancel={() => setConfirm(null)}
          onConfirm={() => void send()}
        >
          <p>
            Recipient: <strong>{current.preview.recipient}</strong>
          </p>
          <p>Subject: {current.preview.subject}</p>
          <p>
            This sends to this family only. Provider acceptance does not
            guarantee inbox delivery.
          </p>
        </Confirm>
      )}
    </div>
  );
}
