import "server-only";
import {
  randomBytes,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { Types, type ClientSession } from "mongoose";
import { connectDatabase } from "@/lib/db.server";
import { appOrigin, rateLimitSecret } from "@/lib/config.server";
import { AuthError } from "@/modules/auth/errors";
import {
  tokenDigest,
  type resolveCoupleSession,
} from "@/modules/auth/service.server";
import { authModels } from "@/modules/auth/models.server";
import { familyModels } from "@/modules/families/model.server";
import { getFamily } from "@/modules/families/service.server";
import { weddingModel } from "@/modules/wedding/model.server";
import { eventModel } from "@/modules/events/model.server";
import {
  invitationModels,
  requireInvitationIndexes,
  type EmailAttemptRecord,
} from "./model.server";
import {
  invitationTokenSchema,
  linkSchema,
  prepareSchema,
  sendSchema,
  type GuestInvitation,
  type EmailPreview,
  type EmailAttemptDTO,
} from "./validation";
import {
  deliverySettings,
  invitationUrl,
  emailContent,
  sendViaResend,
  type EmailPayload,
  type EmailTransport,
} from "./email.server";
type Actor = NonNullable<Awaited<ReturnType<typeof resolveCoupleSession>>>;
const invalid = () =>
  new AuthError(
    "INVITATION_UNAVAILABLE",
    404,
    "This invitation is unavailable. Please contact the couple for a current link.",
  );
const stale = () =>
  new AuthError(
    "VERSION_CONFLICT",
    409,
    "Invitation details changed. Load the latest details and prepare a new preview.",
  );
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function validId(id: string) {
  if (!/^[a-fA-F0-9]{24}$/.test(id))
    throw new AuthError("NOT_FOUND", 404, "Family not found.");
}
function matches(token: string, hash: string | null | undefined) {
  return (
    !!hash &&
    /^[a-f0-9]{64}$/.test(hash) &&
    timingSafeEqual(
      Buffer.from(tokenDigest(token), "hex"),
      Buffer.from(hash, "hex"),
    )
  );
}
async function owned(actor: Actor, id: string, session: ClientSession) {
  validId(id);
  const c = await connectDatabase();
  const wedding = await weddingModel(c)
    .findOne({
      _id: actor.weddingId,
      ownerAccountId: actor.account.id,
      setupStatus: "complete",
    })
    .session(session)
    .lean();
  if (!wedding)
    throw new AuthError(
      "SETUP_REQUIRED",
      409,
      "Complete wedding setup before managing invitations.",
    );
  const family = await familyModels(c)
    .Family.findOne({ _id: id, weddingId: wedding._id })
    .select("+tokenHash +emailAttemptId")
    .session(session)
    .lean();
  if (!family) throw new AuthError("NOT_FOUND", 404, "Family not found.");
  return { wedding, family };
}
async function view(
  weddingId: Types.ObjectId,
  familyId: Types.ObjectId,
  session: ClientSession,
): Promise<GuestInvitation> {
  const c = await connectDatabase();
  const wedding = await weddingModel(c)
    .findOne({ _id: weddingId, setupStatus: "complete" })
    .session(session)
    .lean();
  const family = await familyModels(c)
    .Family.findOne({ _id: familyId, weddingId })
    .session(session)
    .lean();
  if (!wedding || !family) throw invalid();
  const rows = await familyModels(c)
    .Invitation.find({ weddingId, familyId })
    .select("eventId")
    .session(session)
    .lean();
  const events = await eventModel(c)
    .find({
      weddingId,
      _id: { $in: rows.map((r) => r.eventId) },
      status: "published",
    })
    .sort({ startsAt: 1, _id: 1 })
    .session(session)
    .lean();
  return {
    wedding: {
      groomName: wedding.groomName ?? "",
      brideName: wedding.brideName ?? "",
      weddingDate: wedding.weddingDate ?? "",
      venue: wedding.venue ?? "",
    },
    family: {
      name: family.name,
      invitedCount: family.invitedCount,
      invitationAcceptedAt: family.invitationAcceptedAt?.toISOString() ?? null,
    },
    events: events.flatMap((e) =>
      e.startsAt && e.venue
        ? [
            {
              id: e._id.toString(),
              name: e.name,
              startsAt: e.startsAt.toISOString(),
              venue: e.venue,
            },
          ]
        : [],
    ),
  };
}
export async function generateInvitationLink(
  actor: Actor,
  id: string,
  input: unknown,
) {
  const parsed = linkSchema.parse(input),
    c = await connectDatabase();
  await requireInvitationIndexes(c);
  const token = randomBytes(32).toString("base64url");
  const result = await c.transaction(async (session) => {
    const { family, wedding } = await owned(actor, id, session);
    if (family.revision !== parsed.expectedRevision) throw stale();
    if (family.tokenHash && !parsed.replace)
      throw new AuthError(
        "REPLACEMENT_CONFIRMATION_REQUIRED",
        409,
        "A link already exists. Confirm replacing it to invalidate the old link and guest sessions.",
      );
    const saved = await familyModels(c)
      .Family.findOneAndUpdate(
        {
          _id: family._id,
          weddingId: wedding._id,
          revision: parsed.expectedRevision,
        },
        {
          $set: { tokenHash: tokenDigest(token) },
          $inc: { tokenVersion: 1, revision: 1 },
        },
        { session, returnDocument: "after" },
      )
      .lean();
    if (!saved) throw stale();
    await invitationModels(c).GuestSession.deleteMany(
      { kind: "guest", weddingId: wedding._id, familyId: family._id },
      { session },
    );
    return { tokenVersion: saved.tokenVersion, revision: saved.revision };
  });
  return { ...result, invitationUrl: invitationUrl(appOrigin(), token) };
}
function attemptDTO(
  r: EmailAttemptRecord & { _id: Types.ObjectId },
): EmailAttemptDTO {
  return {
    id: r._id.toString(),
    status: r.status,
    preview: JSON.parse(r.snapshot) as EmailPreview,
    createdAt: r.createdAt.toISOString(),
    acceptedAt: r.acceptedAt?.toISOString() ?? null,
    retryUntil: new Date(r.createdAt.getTime() + 23 * 3600000).toISOString(),
  };
}
export async function invitationManagement(actor: Actor, id: string) {
  const family = await getFamily(actor, id),
    c = await connectDatabase();
  const invitation = await c.transaction(async (session) => {
    const { family: f, wedding } = await owned(actor, id, session);
    return view(wedding._id, f._id, session);
  });
  const latest = await invitationModels(c)
    .EmailAttempt.findOne({ weddingId: actor.weddingId, familyId: id })
    .select("+snapshot")
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  return {
    family,
    invitation,
    origin: appOrigin(),
    deliveryAvailable: deliverySettings().available,
    latest: latest ? attemptDTO(latest) : null,
  };
}
function payloadFor(
  preview: EmailPreview,
  origin: string,
  token: string,
): EmailPayload {
  return {
    from: `Make My Marriage <${preview.sender ?? "invitations@example.invalid"}>`,
    to: [preview.recipient],
    subject: preview.subject,
    ...emailContent(preview, invitationUrl(origin, token)),
  };
}
export async function prepareInvitationEmail(
  actor: Actor,
  id: string,
  input: unknown,
  now = new Date(),
) {
  const parsed = prepareSchema.parse(input),
    c = await connectDatabase();
  await requireInvitationIndexes(c);
  const settings = deliverySettings(),
    keyHash = digest(parsed.requestKey);
  return c.transaction(async (session) => {
    const { family, wedding } = await owned(actor, id, session),
      { EmailAttempt } = invitationModels(c);
    if (!matches(parsed.token, family.tokenHash)) throw invalid();
    const replay = await EmailAttempt.findOne({
      weddingId: wedding._id,
      familyId: family._id,
      keyHash,
    })
      .select("+snapshot")
      .session(session)
      .lean();
    if (replay) {
      if (replay.tokenVersion !== family.tokenVersion) throw stale();
      if (!family.emailAttemptId?.equals(replay._id)) throw stale();
      return attemptDTO(replay);
    }
    if (family.revision !== parsed.expectedRevision) throw stale();
    if (!family.email)
      throw new AuthError(
        "EMAIL_REQUIRED",
        400,
        "Save a valid family email address before preparing an email.",
      );
    const previous = family.emailAttemptId
      ? await EmailAttempt.findOne({
          _id: family.emailAttemptId,
          weddingId: wedding._id,
          familyId: family._id,
        })
          .session(session)
          .lean()
      : null;
    if (
      previous?.status === "sending" &&
      previous.leaseUntil &&
      previous.leaseUntil > now
    )
      throw new AuthError(
        "SEND_IN_PROGRESS",
        409,
        "An email is still being sent. Reload its status before proceeding.",
      );
    if (
      previous &&
      ["sending", "uncertain"].includes(previous.status) &&
      !parsed.confirmUncertainResend
    )
      throw new AuthError(
        "SEND_UNRESOLVED",
        409,
        "The previous send is unresolved. Retry that attempt or explicitly acknowledge that a new email may duplicate it.",
      );
    if (
      previous &&
      parsed.confirmUncertainResend &&
      now.getTime() - previous.updatedAt.getTime() < 60000
    )
      throw new AuthError(
        "RATE_LIMITED",
        429,
        "Wait one minute and check the previous send before preparing another email.",
      );
    if (previous?.status === "accepted" && !parsed.confirmResend)
      throw new AuthError(
        "RESEND_CONFIRMATION_REQUIRED",
        409,
        "An invitation was already accepted for sending. Confirm sending another email.",
      );
    if (
      previous?.acceptedAt &&
      now.getTime() - previous.acceptedAt.getTime() < 60000
    )
      throw new AuthError(
        "RATE_LIMITED",
        429,
        "Wait one minute before sending another invitation.",
      );
    const invitation = await view(wedding._id, family._id, session);
    if (!invitation.events.length)
      throw new AuthError(
        "NO_PUBLISHED_EVENTS",
        400,
        "Assign and publish at least one ceremony before preparing an email.",
      );
    const preview: EmailPreview = {
      sender: settings.sender,
      recipient: family.email,
      subject:
        `You're invited to celebrate with ${wedding.groomName} & ${wedding.brideName}`.replace(
          /[\r\n]+/g,
          " ",
        ),
      invitation,
    };
    const attemptId = new Types.ObjectId();
    const saved = await familyModels(c)
      .Family.findOneAndUpdate(
        {
          _id: family._id,
          weddingId: wedding._id,
          revision: parsed.expectedRevision,
        },
        { $set: { emailAttemptId: attemptId }, $inc: { revision: 1 } },
        { session, returnDocument: "after" },
      )
      .lean();
    if (!saved) throw stale();
    const [record] = await EmailAttempt.create(
      [
        {
          _id: attemptId,
          weddingId: wedding._id,
          familyId: family._id,
          keyHash,
          payloadHash: digest(
            payloadFor(preview, settings.origin, parsed.token),
          ),
          tokenVersion: family.tokenVersion,
          familyRevision: saved.revision,
          snapshot: JSON.stringify(preview),
          origin: settings.origin,
          status: "ready",
          createdAt: now,
        },
      ],
      { session },
    );
    if (!record) throw new Error("Email preparation failed");
    return attemptDTO(record.toObject());
  });
}
export async function sendInvitationEmail(
  actor: Actor,
  id: string,
  input: unknown,
  transport: EmailTransport = sendViaResend,
  now = new Date(),
) {
  const parsed = sendSchema.parse(input),
    settings = deliverySettings();
  if (!settings.available)
    throw new AuthError(
      "EMAIL_UNAVAILABLE",
      503,
      "Email invitations are unavailable until the sender and public app URL are configured.",
    );
  const c = await connectDatabase();
  await requireInvitationIndexes(c);
  const claim = await c.transaction(async (session) => {
    const { family, wedding } = await owned(actor, id, session),
      { EmailAttempt } = invitationModels(c);
    const record = await EmailAttempt.findOne({
      _id: parsed.attemptId,
      weddingId: wedding._id,
      familyId: family._id,
    })
      .select("+snapshot")
      .session(session)
      .lean();
    if (!record)
      throw new AuthError("NOT_FOUND", 404, "Email preview not found.");
    if (
      !matches(parsed.token, family.tokenHash) ||
      record.tokenVersion !== family.tokenVersion
    )
      throw invalid();
    if (record.status === "accepted")
      return { accepted: true as const, record };
    if (record.createdAt.getTime() + 23 * 3600000 <= now.getTime())
      throw new AuthError(
        "RETRY_WINDOW_EXPIRED",
        409,
        "This send attempt is too old to retry safely. Check the email provider before making another sending decision.",
      );
    if (
      record.status === "sending" &&
      record.leaseUntil &&
      record.leaseUntil > now
    )
      throw new AuthError(
        "SEND_IN_PROGRESS",
        409,
        "This email is still being sent. Wait and reload its status before retrying.",
      );
    if (
      !family.emailAttemptId?.equals(record._id) ||
      family.revision !== record.familyRevision
    )
      throw stale();
    const preview = JSON.parse(record.snapshot) as EmailPreview;
    const current = await view(wedding._id, family._id, session);
    if (
      preview.recipient !== family.email ||
      preview.sender !== settings.sender ||
      record.origin !== settings.origin ||
      digest(current) !== digest(preview.invitation)
    )
      throw stale();
    const payload = payloadFor(preview, record.origin, parsed.token);
    if (digest(payload) !== record.payloadHash) throw stale();
    const saved = await familyModels(c)
      .Family.findOneAndUpdate(
        { _id: family._id, weddingId: wedding._id, revision: family.revision },
        { $inc: { revision: 1 } },
        { session, returnDocument: "after" },
      )
      .lean();
    if (!saved) throw stale();
    await EmailAttempt.updateOne(
      { _id: record._id, weddingId: wedding._id, familyId: family._id },
      {
        $set: {
          status: "sending",
          familyRevision: saved.revision,
          leaseUntil: new Date(now.getTime() + 60000),
        },
      },
      { session },
    );
    return { accepted: false as const, record, payload };
  });
  if (claim.accepted) return { status: "accepted" as const };
  const result = await transport(
    claim.payload,
    "invitation/" + claim.record._id.toString(),
  );
  const { EmailAttempt } = invitationModels(c);
  // A provider call never runs inside a retryable MongoDB transaction.
  await EmailAttempt.updateOne(
    {
      _id: claim.record._id,
      weddingId: actor.weddingId,
      familyId: id,
      status: "sending",
      familyRevision: claim.record.familyRevision + 1,
    },
    {
      $set: {
        status: result.status,
        ...(result.status === "accepted"
          ? { acceptedAt: new Date(), providerId: result.id }
          : {}),
      },
      $unset: { leaseUntil: 1 },
    },
  );
  return { status: result.status };
}
async function throttleExchange(token: string, network: string, now: Date) {
  const c = await connectDatabase(),
    bucket = Math.floor(now.getTime() / 900000),
    end = new Date((bucket + 1) * 900000),
    { RateLimit } = authModels(c);
  for (const [identity, limit] of [
    ["network:" + network, 120],
    ["token:" + tokenDigest(token), 20],
  ] as const) {
    const keyHash = createHmac("sha256", rateLimitSecret())
      .update(`guest-exchange:${bucket}:${identity}`)
      .digest("hex");
    try {
      await RateLimit.updateOne(
        { keyHash },
        { $setOnInsert: { count: 0, windowEndsAt: end } },
        { upsert: true },
      );
    } catch (e) {
      if (!(e && typeof e === "object" && "code" in e && e.code === 11000))
        throw e;
    }
    if (
      !(await RateLimit.findOneAndUpdate(
        { keyHash, count: { $lt: limit }, windowEndsAt: { $gt: now } },
        { $inc: { count: 1 } },
      ).lean())
    )
      throw new AuthError(
        "RATE_LIMITED",
        429,
        "Too many invitation attempts. Please try again later.",
      );
  }
}
export async function exchangeInvitation(
  token: string,
  network: string,
  previous?: string,
  now = new Date(),
) {
  invitationTokenSchema.parse(token);
  await throttleExchange(token, network, now);
  const c = await connectDatabase();
  await requireInvitationIndexes(c);
  const sessionToken = randomBytes(32).toString("base64url"),
    expiresAt = new Date(now.getTime() + 7 * 86400000);
  await c.transaction(async (session) => {
    const { Family } = familyModels(c),
      { GuestSession } = invitationModels(c);
    // Write coordination ensures rotation/deletion cannot leave a usable stale session.
    const family = await Family.findOneAndUpdate(
      { tokenHash: tokenDigest(token) },
      { $inc: { revision: 1 } },
      { session, returnDocument: "after" },
    ).lean();
    if (
      !family ||
      !(await weddingModel(c)
        .exists({ _id: family.weddingId, setupStatus: "complete" })
        .session(session))
    )
      throw invalid();
    if (previous && invitationTokenSchema.safeParse(previous).success)
      await GuestSession.deleteOne(
        { kind: "guest", tokenHash: tokenDigest(previous) },
        { session },
      );
    await GuestSession.create(
      [
        {
          kind: "guest",
          weddingId: family.weddingId,
          familyId: family._id,
          tokenHash: tokenDigest(sessionToken),
          tokenVersion: family.tokenVersion,
          expiresAt,
        },
      ],
      { session },
    );
  });
  return { token: sessionToken, expiresAt };
}
export async function guestInvitation(
  token: string | undefined,
  now = new Date(),
): Promise<GuestInvitation> {
  return guestInvitationAction(token, now, false);
}
export async function acceptGuestInvitation(
  token: string | undefined,
  now = new Date(),
) {
  return guestInvitationAction(token, now, true);
}
async function guestInvitationAction(
  token: string | undefined,
  now: Date,
  accept: boolean,
): Promise<GuestInvitation> {
  if (!token || !invitationTokenSchema.safeParse(token).success)
    throw new AuthError(
      "UNAUTHENTICATED",
      401,
      "Reopen your invitation link to continue.",
    );
  const c = await connectDatabase();
  await requireInvitationIndexes(c);
  return c.transaction(async (session) => {
    const saved = await invitationModels(c)
      .GuestSession.findOne({
        kind: "guest",
        tokenHash: tokenDigest(token),
        expiresAt: { $gt: now },
      })
      .session(session)
      .lean();
    if (!saved)
      throw new AuthError(
        "UNAUTHENTICATED",
        401,
        "Reopen your invitation link to continue.",
      );
    const family = await familyModels(c)
      .Family.findOne({
        _id: saved.familyId,
        weddingId: saved.weddingId,
        tokenVersion: saved.tokenVersion,
        tokenHash: { $type: "string" },
      })
      .session(session)
      .lean();
    if (!family) throw invalid();
    const invitation = await view(saved.weddingId, saved.familyId, session);
    if (accept && !family.invitationAcceptedAt) {
      const updated = await familyModels(c).Family.updateOne(
        {
          _id: family._id,
          weddingId: saved.weddingId,
          tokenVersion: saved.tokenVersion,
          revision: family.revision,
        },
        { $set: { invitationAcceptedAt: now }, $inc: { revision: 1 } },
        { session },
      );
      if (updated.modifiedCount !== 1) throw invalid();
      invitation.family.invitationAcceptedAt = now.toISOString();
    }
    return invitation;
  });
}
export async function logoutGuest(token: string | undefined) {
  if (token && invitationTokenSchema.safeParse(token).success)
    await invitationModels(await connectDatabase()).GuestSession.deleteOne({
      kind: "guest",
      tokenHash: tokenDigest(token),
    });
}
