# **Make My Marriage** 

System Design and Architecture 

Version 1.0 | 23 October 2026 | Personal-use first release 

## **Executive decision** 

A TypeScript modular monolith using Next.js App Router for the frontend and Node.js route handlers for backend APIs, deployed on Vercel. MongoDB Atlas with Mongoose provides persistence. One shared couple account owns one wedding. Wedding is the tenant boundary for all application data. 

Families use secure invitation links without accounts. They can view assigned events, update event-wise RSVPs, follow directions, watch YouTube livestreams, and open a shared OneDrive photo folder. 

## **Scope precedence** 

This document follows the PRD with subsequent agreed changes: no public registration; OneDrive replaces the in-app gallery and photo storage; JPEG is advisory; the photo-folder button hides seven days after the wedding; external access revocation and file deletion are manual. 

The design targets approximately 50 families and 200 externally managed photos. English, one traditional invitation template, and Indian Standard Time are the first-release defaults. Engineering defaults below are recommendations for implementation, not additional product features. 

## **Included and excluded** 

Included: shared couple login, wedding setup, events, tasks, spending by payer and event, family invitations, RSVP, dashboard, manual WhatsApp sharing, maps links, YouTube embeds, and OneDrive folder access. 

Excluded: Google Places and vendor discovery, bulk email, dedicated queues, Cloudflare R2, app-managed photo uploads, per-photo records, image processing, Microsoft Graph integration, automatic WhatsApp delivery, payment processing, and individual guest accounts. 

No application or infrastructure is deployed by this document. 

## **Reading map** 

1. Architecture and modules 

2. Collections and indexes 

3. Authentication and tenant isolation 

4. API contracts and workflows 

5. OneDrive lifecycle 

6. Consistency and deletion 

7. Deployment and operations 

8. Verification and references 

MAKE MY MARRIAGE | SYSTEM DESIGN v1.0 

1 

# **1. Architecture and modules** 

## **System topology** 

Couple browser / guest browser -> HTTPS -> Next.js on Vercel -> module services -> Mongoose repositories -> MongoDB Atlas. 

Next.js -> Resend for password-reset email only. 

Guest browser -> WhatsApp sharing, Google Maps directions, YouTube embeds, and OneDrive external folder. 

Photos never pass through Vercel or MongoDB. OneDrive owns external viewing, upload permissions and storage. 

## **Request handling** 

Route handler -> validate input -> resolve authenticated actor -> enforce authorization -> invoke service -> query repository -> return an explicit safe response DTO. 

Server Components call services directly; they do not make loopback requests to their own API. Client Components handle interactive forms and mutation feedback. All database and password-hashing paths use the Node.js runtime. Mongoose must remain server-only. [1, 2] 

## **Module ownership** 

- Auth: couple sessions, password reset, guest token exchange, revocation and throttling. 

- Wedding: names, wedding date, venue, timezone, template and OneDrive settings. 

- Events: presets, publication state, dates, venues, maps and livestream references. 

- Tasks: responsible person as text, due date and completion. 

- Expenses: integer paise, payer grouping, event association and totals. 

- Families: household records, invited count, token lifecycle and assignments. 

- RSVP: one response per family/event invitation and count validation. 

- Dashboard: read-only aggregates over authoritative records. 

- Sharing and photos: WhatsApp message formatting and authorized OneDrive redirects. 

- Operations: provisioning, index management, migrations and optional retries. 

## **Repository layout and boundaries** 

src/app contains couple pages, guest pages and API adapters. src/modules/<module> contains validation, services, repositories and DTOs. src/lib contains database connections, clock, crypto, logging and email adapters. scripts contains provisioning, indexes, migrations and maintenance commands. 

Keep routes thin. Services accept a CoupleActor or GuestActor, not arbitrary request bodies as database filters. Cross-module changes use explicit orchestration functions. No separate Express server, internal network, broker or Redis is required. 

MAKE MY MARRIAGE | SYSTEM DESIGN v1.0 

2 

# **2. Collections and indexes** 

## **Shared conventions** 

Use ObjectIds and createdAt/updatedAt timestamps. Domain records carry weddingId. Store event instants in UTC; display them in Asia/Kolkata. Store wedding date and task due date as local YYYY-MM-DD values. Store money as integer paise and format in INR. 

## **Core collections** 

- accounts: emailNormalized, passwordHash, weddingId, authVersion. Unique email and unique weddingId. 

- weddings: ownerAccountId, groomName, brideName, weddingDate, venue, mapsUrl, timezone, oneDriveFolderUrl, photoVisibleUntil. Unique ownerAccountId. 

- events: weddingId, name, startsAt, venue, mapsUrl, youtubeVideoId, status (draft/published). Index weddingId + startsAt. 

- families: weddingId, name, phoneE164, invitedCount, tokenHash, tokenVersion, revision. Unique tokenHash; index weddingId + name. 

- eventInvitations: weddingId, familyId, eventId, status (pending/attending/notAttending), attendingCount, version. Unique weddingId + familyId + eventId; index weddingId + eventId + status. 

- tasks: weddingId, title, assigneeName, dueDate, eventId, status. Index weddingId + status + dueDate. 

- expenses: weddingId, description, amountPaise, spentOn, payerName, payerKey, eventId, idempotencyKey. Index weddingId + spentOn; unique weddingId + idempotencyKey. 

## **Authentication and operational collections** 

- sessions: kind (couple/guest), tokenHash, accountId or familyId, weddingId, authVersion or tokenVersion, expiresAt. Unique tokenHash; TTL on expiresAt. 

- passwordResetTokens: accountId, tokenHash, expiresAt, consumedAt. Unique tokenHash; TTL on expiresAt. 

- rateLimits: keyHash, count, windowEndsAt. Unique keyHash; TTL on windowEndsAt. 

- maintenanceJobs, only when needed: type, payload, status, attempts, nextAttemptAt, leaseUntil, dedupeKey, lastErrorCode. Unique dedupeKey; index status + nextAttemptAt. 

## **Relationship and validation rules** 

Mongoose validates shapes and enums. Services verify that referenced families and events belong to the actor's wedding. Unique indexes enforce duplicate prevention; schema validation alone is insufficient. 

One family count applies to all its invitations. One expense has one payer; split purchases become separate contribution records. Optional event references do not determine ownership. No photo, vendor, or individual guest collection exists. 

Use a bundled cover image initially. Optional personal cover customization can be an operator-replaced deployment asset; no settings upload service is included in this storage-free version. 

MAKE MY MARRIAGE | SYSTEM DESIGN v1.0 

3 

# **3. Authentication and tenant isolation** 

## **Shared couple account** 

Provision the account through a one-time operator script. No public signup endpoint. Never commit the initial password. Use Argon2id with parameters benchmarked for the chosen runtime. 

Login generates a random 32-byte session token. Store its SHA-256 hash, not plaintext, in MongoDB. Set a Secure, HttpOnly, SameSite=Lax cookie. Each device receives an independent session. Proposed absolute session lifetime: seven days. 

Every protected request checks token hash, expiresAt, account, wedding association and authVersion. Logout deletes the current session and clears its cookie. Password changes require the current password and invalidate sessions. [1] 

## **Password reset** 

Return a generic acknowledgement regardless of email existence. Create a random, hashed, single-use reset token with a proposed 30-minute expiration; send the link using Resend. Atomically consume it, change the password, increment authVersion and revoke existing sessions. 

Keep the reset origin configured server-side. Never derive it from an untrusted Host header. Log provider failures safely and allow another reset request; no batch email processor is needed. Do not send emails inside a retryable database transaction. [4] 

## **Guest invitation exchange** 

Generate a random 32-byte token for each family and store only its hash. The invitation entry page exchanges it using a same-origin POST for a restricted guest cookie, then redirects to a clean URL. No state mutation on GET. Use no-referrer and no external assets before exchange; redact token-bearing paths from application logs. 

Guest sessions have a proposed seven-day absolute lifetime and retain familyId, weddingId and tokenVersion. Re-opening a valid invitation can establish a new session. Every request rechecks that the family exists and its version matches. 

Possession of the link authorizes RSVP changes. Forwarding it delegates the same access. Rotation replaces tokenHash and increments tokenVersion, invalidating old links and sessions. With hash-only storage, links are copied/shared at generation; later re-sharing requires regeneration. Warn the couple before doing so. 

## **Enforcement** 

Resolve weddingId from the authenticated actor, never from a client-supplied tenant field. Couple actors manage only their wedding. Guest actors read only their family and assigned published events, update their own invitations, and access the shared folder before cutoff. 

Apply checks in services and repositories, not just page layouts. Protect mutations with Origin checks and CSRF defenses. Use shared MongoDB throttling for login, reset and token exchange. Return explicit DTOs; never serialize model documents wholesale. 

TTL deletion is asynchronous. Reject expired sessions and reset tokens in application logic even if their records still exist. [3] 

MAKE MY MARRIAGE | SYSTEM DESIGN v1.0 

4 

# **4. API contracts and workflows** 

## **Illustrative HTTP contracts** 

- POST /api/auth/login; POST /api/auth/logout. 

- POST /api/auth/forgot-password; POST /api/auth/reset-password; POST /api/auth/change-password. 

- GET, PATCH /api/wedding; GET /api/dashboard. 

- GET, POST /api/events; PATCH, DELETE /api/events/:id. 

- GET, POST /api/tasks; PATCH, DELETE /api/tasks/:id. 

- GET, POST /api/expenses; PATCH, DELETE /api/expenses/:id. 

- GET, POST /api/families; PATCH, DELETE /api/families/:id. 

- PUT /api/families/:id/events replaces assignments after confirmation. 

- POST /api/families/:id/invitation-link generates/rotates a token and returns the link once. 

- POST /api/guest/exchange; GET /api/guest/invitation. 

- PUT /api/guest/rsvp/:invitationId accepts status, attendingCount and expectedVersion. 

- GET /api/guest/photos checks authorization/cutoff and redirects to OneDrive. 

## **Responses** 

Validate request fields server-side. Use 400 for invalid input, 401 for missing or expired sessions, 404 for missing or foreign resources, 409 for stale revisions, and 429 for rate limits. Errors contain a stable code, safe message and requestId. Mutations return canonical saved data. Paginate lists and use private/no-store for authenticated and guest content. 

## **Setup and invitation workflow** 

Create wedding and six preset events once: engagement, haldi, mehendi, sangeet, wedding and reception. Incomplete events remain drafts. Publish only with name, date/time and venue. Setup retries must not duplicate presets. 

Create a family and assignments transactionally, generate its link, construct a WhatsApp message, and let the couple send it. Opening WhatsApp does not prove delivery. Event reminders reference only assigned events. 

## **RSVP and dashboard workflow** 

Resolve guest -> locate its assigned published event -> validate count -> conditionally update invitation version. Attending requires an integer from one to invitedCount; not attending records zero. Unanswered invitations stay pending. A stale write returns 409 rather than silently overwriting another response. 

Reject reductions of invitedCount below existing confirmed counts until the couple resolves the conflict. Aggregate dashboard figures from source records. Show attendance per event; never label a sum across events as unique guests. 

Normalize payer names for grouping, retain display names, and sum integer paise. Tasks are overdue only when pending and their local due date is before today's IST date. 

MAKE MY MARRIAGE | SYSTEM DESIGN v1.0 

5 

# **5. OneDrive lifecycle and external integrations** 

## **Photo-folder experience** 

The couple configures one approved HTTPS OneDrive folder URL. Guest pages show Open Wedding Photos and the exact instruction: Please upload wedding photos in JPEG format. 

The website does not inspect files, enforce JPEG, count photos, display per-photo previews, or perform uploads/deletions. OneDrive permissions determine whether guests can upload and view without sign-in; test this on a separate guest device before distributing links. 

## **Seven-day cutoff convention** 

Use 00:00 Asia/Kolkata on weddingDate + seven calendar days. Example: a wedding on 10 December hides the button from 17 December at 00:00 IST. This is a date-based engineering convention, not seven days after an event start time. 

Recompute photoVisibleUntil when the wedding date changes. Store the UTC instant and compare with server time. The button is available only when a folder link exists and now is before the cutoff. 

Do not expose the raw OneDrive link in guest page HTML or invitation JSON. Point the button at /api/guest/photos; that endpoint rechecks the family, current folder setting and cutoff before redirecting. Return unavailable after cutoff. Mark both page data and redirect private/no-store. 

For an already-open page, hide the button using the server-provided cutoff and refresh on tab focus. Server checks remain authoritative. No cron job is required for hiding the button. 

## **Manual cleanup** 

Seven days after the wedding, the couple saves photos they wish to keep, removes OneDrive sharing access, and deletes unwanted files in OneDrive. The website cannot verify completion. 

Hiding the button does not revoke copied links, close existing OneDrive tabs, remove downloaded photos or delete stored files. Deleting a family in the app cannot revoke a OneDrive link it already copied. The estimate of 200 photos is not an enforced quota. 

## **Other integrations** 

Resend: password resets only; server-side API key and verified sender. 

WhatsApp: encoded manual share messages; no delivery tracking or automated messaging. 

Maps: validated HTTPS direction links; no Places API or vendor discovery. 

YouTube: parse and store supported video IDs, construct embeds safely, and offer Open on YouTube fallback. Guests see only livestreams for their invited events. 

Validate approved link hosts rather than accepting arbitrary redirect targets. Never fetch user-provided URLs from the server. Do not accept arbitrary iframe HTML. 

MAKE MY MARRIAGE | SYSTEM DESIGN v1.0 

6 

# **6. Consistency, permanent deletion and maintenance** 

## **Deletion rules** 

- Delete event: transactionally delete the event and associated invitations; unset eventId on tasks and expenses, preserving tasks and spending. 

- Remove event assignment: delete that invitation and response after confirmation. Other family invitations remain. 

- Delete family: transactionally remove the family, its invitations and guest sessions. All future access checks fail. 

- Delete expense/task: remove the wedding-scoped record after confirmation and refresh summaries. 

- Clear OneDrive setting: removes app access only; external files and permissions are untouched. 

- Rotate invitation: replace hash and increment version; old links and guest sessions stop working. 

There is no product trash or undo feature. Backups may retain deleted data until their retention period ends; external OneDrive retention is separate. 

## **Atomicity and duplicate prevention** 

Use database transactions for related multi-collection writes. RSVP changes, assignment edits and family deletion coordinate through a family revision write so concurrent changes conflict and retry rather than leaving inconsistent records. Use invitation versions for stale client writes. 

Unique indexes prevent duplicate assignments. Expense creation accepts a client-generated idempotency key; a retried submission returns the original result instead of double-counting spending. Keep external email requests outside transaction callbacks because callbacks may retry. 

## **Lightweight maintenance** 

TTL indexes eventually remove expired sessions, reset tokens and rate-limit records. There are no photo cleanup jobs or bulk email batches. 

Keep maintenanceJobs optional until an actual retryable operation exists. When used, atomically claim a bounded batch with a lease, retry with exponential backoff, enforce a maximum attempt count, and record sanitized failures for manual review. Use dedupeKey for idempotency. 

Start with an operator command for retries. Select a scheduler only if a real recurring job is introduced. Do not depend on a background timer continuing after a serverless response. 

## **Failure behavior** 

Database failure: fail safely, show a retry message and never claim the write succeeded. Lost response after a successful write: retry through idempotency/version checks. Resend failure: generic reset acknowledgement, safe logging and a new user-initiated attempt. External media failure: provide a clear unavailable state or direct-link fallback where authorized. 

No distributed cache, message broker or search cluster is justified by this workload. Add infrastructure only after a measured need. 

MAKE MY MARRIAGE | SYSTEM DESIGN v1.0 

7 

# **7. Deployment, security and operations** 

## **Environment and release** 

Deploy a single Next.js application on Vercel. Pin supported package/runtime versions and commit the lockfile during implementation. Use Node.js for database and cryptography. Reuse a cached Mongoose connection promise within warm instances; bound connection pools for the small workload. [2] 

Separate development and production databases and secrets. Preview deployments must not write to production data. Keep the application and Atlas regions close where available. Apply indexes and migrations explicitly before enabling dependent code; prefer backward-compatible changes to allow rollback. 

## **Configuration** 

Server-only variables: MONGODB_URI, RESEND_API_KEY, EMAIL_FROM, APP_ORIGIN, and an optional operator maintenance credential. OneDrive URL is a protected wedding setting. No R2 or Microsoft Graph credentials are needed. 

Never expose credentials through NEXT_PUBLIC variables. Use least-privilege database credentials, HTTPS, restricted production access, and network controls supported by the chosen deployment configuration. Do not assume Vercel outbound addresses are static. 

## **Access and browser security** 

Use secure cookies, same-origin mutations, CSRF protection, shared rate limits, safe URL allowlists, output escaping and a content security policy appropriate to YouTube. Exclude guest/reset routes from indexing and avoid external content while secret tokens appear in URLs. 

Authorization happens on every request, including redirect endpoints. Protected content must not enter shared CDN caches. Client hiding alone is never authorization. Normalize error responses so token hashes, emails and database details are not exposed. 

## **Observability and recovery** 

Log requestId, operation, duration and safe error codes. Redact passwords, tokens, invitation paths, full reset URLs and database connection strings. Monitor database errors, application errors, reset failures and RSVP conflicts. 

Select an Atlas backup mechanism before production; do not assume a free tier includes backups. Proposed operational targets: daily recoverable data and restore within one day. Test restoration into an isolated database. OneDrive cleanup and preservation remain the couple's responsibility. 

## **Capacity and cost** 

Plan for one wedding and around 50 families. Photo traffic is served by OneDrive, not the application. Aggregate dashboard data on demand; optimize only if measured latency requires it. 

The application is free to use, but provider plans, domain, email and database costs require review at deployment. No price, free-tier entitlement or provider availability guarantee is assumed. Exact plan, region, domain, email sender and any future scheduler remain deployment selections. 

MAKE MY MARRIAGE | SYSTEM DESIGN v1.0 

8 

# **8. Verification, delivery and references** 

## **Critical checks before launch** 

- Sessions: multi-device access, logout, expiration before TTL cleanup, password reset single use and revocation. 

- Isolation: foreign wedding/family/event IDs denied; no uninvited event or private management data returned to guests. 

- Invitations: hashed tokens, rotation revoking old links and sessions, deletion denying access. 

- RSVP: count bounds, not-attending zero, unique responses, stale updates and assignment-removal races. 

- Expenses: accurate paise totals, duplicate-submit protection and event deletion preserving costs. 

- Photos: before/at/after cutoff in IST, wedding-date changes, missing link, stale open page and redirect rejection after expiry. 

- Deletion: transaction rollback, no orphaned invitations and cross-wedding deletion denial. 

- UX: phone-sized invitations, WhatsApp messages, Maps links, YouTube fallback and OneDrive permission test on a guest device. 

- Operations: isolated preview data, safe logs, working reset sender and successful restore exercise. 

## **Implementation sequence** 

1. Foundation: Next.js structure, MongoDB connection, schemas, indexes and provisioning. 

2. Access: couple sessions, password reset, guest token exchange and tenant authorization. 

3. Planning: wedding setup, events, tasks, expenses and dashboard. 

4. Families: assignments, traditional invitation, versioned RSVP and manual WhatsApp sharing. 

5. External access: directions, YouTube, OneDrive link and visibility cutoff. 

6. Release: critical tests, mobile review, backup restoration and production configuration. 

## **Official technical references** 

Consulted 23 October 2026. Product choices come from the agreed requirements; these references support implementation mechanics. Verify deployment-specific configuration during implementation. 

[1] Next.js authentication: https://nextjs.org/docs/app/guides/authentication 

Sessions and authorization near data access. 

[2] Mongoose with Next.js: https://mongoosejs.com/docs/nextjs.html 

Integration and runtime considerations. 

- [3] MongoDB TTL indexes: https://www.mongodb.com/docs/manual/core/index-ttl/ 

Asynchronous expiration cleanup; application expiry checks remain required. 

[4] Resend send-email API: https://resend.com/docs/api-reference/emails/send-email 

Server-side transactional email. 

## **Tradeoffs** 

The monolith minimizes deployment work. Custom sessions support immediate revocation but require careful security implementation. Family links remove signup friction but can be forwarded. OneDrive removes storage infrastructure while leaving permissions and cleanup manual. Source-record aggregates favor correctness at this scale. 

MAKE MY MARRIAGE | SYSTEM DESIGN v1.0 

9 

