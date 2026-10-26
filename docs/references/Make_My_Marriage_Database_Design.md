# **Make My Marriage** 

Database Design Document 

Version 1.0 | 23 October 2026 | MongoDB Atlas + Mongoose 

## **Purpose and scope** 

Define the logical model, field contracts, relationships, indexes, validation, transactions, query patterns and lifecycle rules for the agreed personal-use application. This is an implementation specification, not an executed database migration. 

The system supports one provisioned couple account owning one wedding, approximately 50 families, multiple events, family-level invitations, event-wise RSVPs, tasks and spending. Both partners share the same account; guests have no accounts. 

Photo storage and uploads happen in OneDrive. The database stores one folder link and its website visibility cutoff, not individual files. JPEG is a request only. The couple manually revokes OneDrive sharing and deletes photos. 

## **Design principles** 

- Wedding is the tenant boundary. Derive weddingId from the authenticated actor; never trust a submitted tenant ID. 

- Separate collections for independently changing entities. Link families and events through eventInvitations. 

- Source records are authoritative. Dashboard totals are calculated on demand, not duplicated in counters. 

- Store only hashes of session, reset and invitation tokens. Session expiration is checked before access. 

- Permanent deletion is explicit and transactional when related collections are affected. 

- Keep infrastructure small. No photo collection, vendor collection, dedicated queue or bulk-email tables. 

## **Notation and engineering defaults** 

ObjectId means a MongoDB object identifier; Date means a BSON UTC date; Int means a safe integer stored as a BSON number through Mongoose Number with Number.isSafeInteger validation. String limits and expiry durations in this document are proposed implementation defaults. 

R means required; O means optional. O fields are absent when unset rather than stored as null unless explicitly stated. All persistent collections have _id. Domain collections and sessions/reset records include createdAt and updatedAt where useful. Examples use symbolic IDs for readability. 

## **Contents** 

1. Relationships and conventions 

2. Accounts and wedding settings 

3. Events and families 

4. Invitations, tasks and expenses 

5. Sessions and operational data 

6. Index catalog 

7. Transactions and deletion 

8. Queries and example records 

9. Lifecycle, deployment and verification 

MAKE MY MARRIAGE | DATABASE DESIGN v1.0 

1 

# **1. Relationships and conventions** 

## **Logical relationship map** 

Account 1 <-> 1 Wedding (after setup). 

Wedding 1 -> many Events, Families, Tasks and Expenses. 

Family 1 -> many EventInvitations; Event 1 -> many EventInvitations. 

EventInvitation connects exactly one family to exactly one event within the same wedding. 

Task and Expense each optionally reference one Event in their wedding. 

Account 1 -> many couple Sessions and PasswordResetTokens. 

Family 1 -> many guest Sessions. Operational rate limits and maintenance records are not product tenants. 

## **Ownership lifecycle** 

Create the account and a wedding shell together in a provisioning transaction using preallocated IDs. Unique accounts.weddingId and weddings.ownerAccountId enforce one-to-one uniqueness. Setup may initially be incomplete, but the ownership references always exist. 

The wedding shell has setupStatus=draft and optional setup fields. Completing setup requires both names, weddingDate and venue. No guest invitations are shared until setup is complete. Account creation is operator-only; there is no public registration collection or endpoint. 

## **Shared modeling rules** 

- Use timestamps:true for normal domain models. Use strict schemas and explicit write allowlists. 

- All event/family/task/expense/invitation reads and writes include weddingId. Auth collections use exact token hashes and then verify the stored subject and wedding. 

- Foreign keys are ObjectIds, not embedded documents. MongoDB does not automatically enforce these relationships; services must check them. 

- Do not embed growing RSVP arrays into families or events. Use the association collection. 

- Include an explicit version integer on editable records that need optimistic concurrency; never assume Mongoose __v protects arbitrary updates. 

- Store instants in UTC. Local weddingDate, dueDate and spentOn are validated YYYY-MM-DD calendar strings. Display in Asia/Kolkata. 

## **Privacy and permissions** 

Guests receive DTOs containing their family name/count, their assigned published events and their responses. They never receive other family records, expenses, tasks, token hashes or account credentials. 

The OneDrive URL is not returned by the invitation DTO. A separate authorized endpoint checks current time and redirects. Database access credentials remain server-only. Disable accidental credential/hash selection in models and still use explicit projections. 

MAKE MY MARRIAGE | DATABASE DESIGN v1.0 

2 

# **2. Accounts and wedding settings** 

## **accounts** 

- emailNormalized: String, R, trimmed/lowercased, max 254; unique. Do not apply provider-specific dot or plus rewriting. 

- passwordHash: String, R; encoded Argon2id hash, excluded from default reads. 

- weddingId: ObjectId, R; unique reference to weddings. 

- authVersion: Int, R, default 0, minimum 0; increment when revoking all couple sessions. 

- createdAt, updatedAt: Date, R. 

No plaintext password, password confirmation, partner subaccount or guest role is stored. Each partner's device creates an independent session for the same account. 

## **weddings** 

- ownerAccountId: ObjectId, R; unique reference to accounts. 

- setupStatus: String, R; draft or complete; default draft. 

- groomName, brideName: String, O in draft, R when complete; trimmed, 1-100 characters. 

- weddingDate: String, O in draft, R when complete; valid YYYY-MM-DD. 

- venue: String, O in draft, R when complete; trimmed, max 500 characters. 

- mapsUrl: String, O; approved HTTPS directions link, max 2048 characters. 

- timezone: String, R; fixed Asia/Kolkata in version 1. 

- templateKey: String, R; fixed traditional-v1 in version 1. 

- coverAssetKey: String, R; default bundled traditional asset identifier, not an arbitrary file path. 

- oneDriveFolderUrl: String, O; approved HTTPS sharing URL, max 2048 characters; protected configuration. 

- photoVisibleUntil: Date, O in draft; required when weddingDate exists, derived by server. 

- presetsSeededAt: Date, O; marks successful one-time event seeding. 

- version: Int, R, default 0; used for setup/settings conflicts. 

- createdAt, updatedAt: Date, R. 

## **Derived fields and setup consistency** 

photoVisibleUntil is midnight IST on weddingDate + seven calendar days, converted to a UTC instant. For weddingDate=2026-12-10, cutoff is 2026-12-16T18:30:00.000Z (17 December, 00:00 IST). 

Recompute it in the same write as a wedding-date change. Never accept a client-supplied cutoff. A folder URL can be absent while the wedding is complete. The guest button is visible only when a link exists and server time is before cutoff. 

Complete setup and insert the six draft presets in one transaction guarded by the wedding version/presetsSeededAt. A retry must not duplicate presets. Personal cover replacement is an operator-managed deployment asset, not a database upload workflow. 

MAKE MY MARRIAGE | DATABASE DESIGN v1.0 

3 

# **3. Events and families** 

## **events** 

- weddingId: ObjectId, R; owning wedding. 

- name: String, R; trimmed, 1-100 characters. 

- presetKey: String, O; engagement, haldi, mehendi, sangeet, wedding or reception. Custom events omit it. 

- status: String, R; draft or published; default draft. 

- startsAt: Date, O for draft, R for published. 

- venue: String, O for draft, R for published; max 500 characters. 

- mapsUrl: String, O; approved HTTPS directions link. 

- youtubeVideoId: String, O; parsed supported video identifier, not embed HTML. 

- version: Int, R, default 0; concurrency control. 

- createdAt, updatedAt: Date, R. 

Event names are not unique. Draft presets may omit time/venue and remain hidden from guests. Publishing requires name, startsAt and venue. Moving an event back to draft hides it but retains assignments and RSVP data; deletion removes them. 

## **families** 

- weddingId: ObjectId, R; owning wedding. 

- name: String, R; trimmed, 1-150 characters. 

- searchName: String, R; server-normalized name for simple search. 

- phoneE164: String, R; normalized international WhatsApp number, max 16 including plus. 

- invitedCount: Int, R; minimum 1; no individual guest documents. 

- tokenHash: String, O until a link is generated; SHA-256 hex digest, exactly 64 characters, excluded from default reads. 

- tokenVersion: Int, R, default 0; increment on link replacement/revocation. 

- revision: Int, R, default 0; coordination field for RSVP/assignment/count/deletion transactions. 

- createdAt, updatedAt: Date, R. 

Family name and phone number are not unique. Separate households may share a contact. Invited count is per family and supplies the maximum RSVP count for each event. Adding a family does not create any guest account. 

## **Invitation lifecycle** 

Generate a cryptographically random 32-byte token and persist its hash. Return the plaintext link once for copying or WhatsApp sharing. A later re-share requires rotation because plaintext is not recoverable from a hash. Explain that rotation invalidates previous links and guest sessions. 

To revoke without issuing a replacement, unset tokenHash and increment tokenVersion. Every guest session checks family existence, a current tokenHash and matching tokenVersion. The link itself has no automatic expiration in version 1; session lifetime and photo-folder cutoff are separate rules. 

## **Search at this scale** 

For approximately 50 families, an escaped substring search on searchName/phoneE164 within weddingId is acceptable. Bound input length and never execute raw user-provided regular expressions. No Atlas Search service is required. 

MAKE MY MARRIAGE | DATABASE DESIGN v1.0 

4 

# **4. Invitations, tasks and expenses** 

## **eventInvitations** 

- weddingId, familyId, eventId: ObjectId, R; all references must share wedding ownership. 

- status: String, R; pending, attending or notAttending; default pending. 

- attendingCount: Int, R; default 0. 

- respondedAt: Date, O; set when a guest submits or updates a response. 

- version: Int, R, default 0; conditional update field. 

- createdAt, updatedAt: Date, R. 

Unique (weddingId, familyId, eventId) prevents duplicate invitations. pending and notAttending require zero attendees; attending requires 1 <= attendingCount <= family's current invitedCount. Only the owning family can respond, and only while the event is published and assigned. 

## **tasks** 

- weddingId: ObjectId, R. 

- title: String, R; trimmed, 1-200 characters. 

- assigneeName: String, R; trimmed, 1-100 characters; a text label, not an account reference. 

- dueDate: String, O; valid local YYYY-MM-DD. 

- eventId: ObjectId, O; reference within the same wedding. 

- status: String, R; pending or completed; default pending. 

- completedAt: Date, O; set on completion and unset on reopening. 

- version: Int, R, default 0; createdAt/updatedAt: Date, R. 

Overdue is computed, not stored: status=pending and dueDate before today's IST date. Event deletion unsets eventId without deleting the task. 

## **expenses** 

- weddingId: ObjectId, R. 

- description: String, R; trimmed, 1-300 characters. 

- amountPaise: Int, R; greater than zero, safely representable; parse decimal INR input without floating-point multiplication errors. 

- spentOn: String, R; valid local YYYY-MM-DD. 

- payerName: String, R; trimmed, 1-100 characters. 

- payerKey: String, R; server-normalized grouping key derived from payerName. 

- eventId: ObjectId, O; reference within wedding. 

- idempotencyKey: String, R; client-generated UUID for create retries; immutable. 

- version: Int, R, default 0; createdAt/updatedAt: Date, R. 

One expense has one payer. Split purchases use separate contributions. A replay with the same idempotencyKey and same create payload returns the original record; a different payload returns conflict. Edits use the record version. Deleting an event preserves expenses and unsets their eventId. 

No reimbursement balances, budget forecasts or payment transactions are modeled. Normalized payer labels are sufficient at this scale; renaming one record does not automatically rename all records. 

MAKE MY MARRIAGE | DATABASE DESIGN v1.0 

5 

# **5. Sessions and operational data** 

## **sessions** 

- kind: String, R; couple or guest. 

- tokenHash: String, R; unique SHA-256 digest of random cookie token, excluded from default reads. 

- weddingId: ObjectId, R; derived at creation, checked against subject. 

- accountId: ObjectId, required only for couple; familyId: ObjectId, required only for guest. Reject the other subject field. 

- authVersion: Int, required only for couple; tokenVersion: Int, required only for guest. 

- expiresAt: Date, R; proposed absolute lifetime seven days for either kind. 

- createdAt, updatedAt: Date, R. 

Every request validates subject existence, current version, wedding association and expiresAt > now. A guest additionally requires an active family tokenHash. TTL is eventual cleanup, never authorization. Logout deletes the relevant session. 

## **passwordResetTokens** 

- accountId: ObjectId, R; tokenHash: String, R, unique, excluded from default reads. 

- issuedAuthVersion: Int, R; account authVersion when issued. 

- expiresAt: Date, R; proposed 30-minute lifetime. 

- consumedAt: Date, O; absent until consumed. 

- createdAt, updatedAt: Date, R. 

Consume only a matching unconsumed, unexpired token whose issuedAuthVersion still matches the account. In a transaction, mark consumed, replace passwordHash, increment authVersion, and delete account sessions and remaining reset tokens. Version coordination prevents two reset links from both changing the password concurrently. 

## **rateLimits** 

- keyHash: String, R, unique; HMAC of normalized rate-limit identity and time bucket using a server secret. Never store raw passwords or tokens. 

- count: Int, R, minimum 0; windowEndsAt: Date, R; createdAt: Date, R. 

An atomic bounded increment controls login, reset and token exchange. Include both network and subject dimensions where appropriate. Set exact thresholds during implementation. Expired buckets must be rejected/replaced by logic even before TTL removes them. 

## **maintenanceJobs (optional, not created until needed)** 

- type: String, R, allowlisted; payload: validated per type, no bearer secrets. 

- status: pending, running, succeeded or failed; attempts: Int, default 0. 

- nextAttemptAt: Date, R; leaseUntil: Date, O; leaseToken: String, O. 

- dedupeKey: String, R, unique; lastErrorCode: String, O; createdAt/updatedAt: Date, R. 

Claim work atomically with a lease and bounded batch size. Acknowledge only with the current leaseToken; expired workers must not complete another worker's job. Backoff and maximum attempts prevent endless retries. No bulk-email or OneDrive deletion jobs exist. 

MAKE MY MARRIAGE | DATABASE DESIGN v1.0 

6 

# **6. Index catalog** 

## **Uniqueness and lookup** 

- accounts: {emailNormalized:1} unique; {weddingId:1} unique. 

- weddings: {ownerAccountId:1} unique. 

- events: {weddingId:1, startsAt:1, _id:1} for ordered schedules; {weddingId:1, presetKey:1} unique with partialFilterExpression {presetKey:{$type:'string'}} for seeded events. 

- families: {weddingId:1, searchName:1}; {tokenHash:1} unique with partialFilterExpression {tokenHash:{$type:'string'}}. 

- eventInvitations: {weddingId:1, familyId:1, eventId:1} unique; {weddingId:1, eventId:1, status:1} for attendance and pending lists. 

- tasks: {weddingId:1, status:1, dueDate:1}. 

- expenses: {weddingId:1, spentOn:-1, _id:-1}; {weddingId:1, idempotencyKey:1} unique. 

- sessions: {tokenHash:1} unique; {accountId:1}; {familyId:1} for revocation/deletion. 

- passwordResetTokens: {tokenHash:1} unique; {accountId:1} for revocation. 

- rateLimits: {keyHash:1} unique. 

- maintenanceJobs, when enabled: {dedupeKey:1} unique; {status:1, nextAttemptAt:1}; {status:1, leaseUntil:1}. 

## **Expiration indexes** 

sessions: {expiresAt:1}, expireAfterSeconds:0. 

passwordResetTokens: {expiresAt:1}, expireAfterSeconds:0. 

rateLimits: {windowEndsAt:1}, expireAfterSeconds:0. 

Do not TTL-index weddingDate or photoVisibleUntil. The photo cutoff changes button visibility, not database retention. Do not auto-delete wedding records seven days after the wedding. 

## **Index implementation notes** 

Optional token/preset fields use partial unique indexes so records without those fields do not collide. Unset optional fields rather than assigning null. Queries intended to use a partial index must include compatible predicates. [3] 

Mongoose unique is an index declaration, not a validator. Catch duplicate-key errors and map them to safe conflict responses. Build indexes through an explicit ensure-indexes script; disable uncontrolled production index creation. [2] 

At this scale, payer/event expense aggregates can scan wedding-scoped expense records. Add indexes only after explaining actual queries and checking execution plans. A small dataset does not justify a text-search cluster or redundant indexes on every field. 

## **Deployment order** 

Inspect existing data -> repair duplicates and invalid fields -> create indexes -> verify index options -> deploy writes depending on them. Do not blindly run destructive index synchronization in production. Built-in _id indexes already exist on every collection. 

MAKE MY MARRIAGE | DATABASE DESIGN v1.0 

7 

# **7. Transactions, concurrency and permanent deletion** 

## **Transaction rules** 

Use Mongoose connection.transaction or session.withTransaction with the same session on every operation. Execute database operations sequentially inside the transaction; avoid Promise.all there. Transaction callbacks can retry, so keep email, WhatsApp, logging side effects with sensitive payloads, and external calls outside them. [1] 

Use the family revision as a write lock for RSVP, invited-count changes, assignment replacement and family deletion. Operations affecting event membership also write the event version before validating publication/existence. Consistent locking order: family records ordered by ID, then event records ordered by ID. Retried transactions re-read constraints. 

Task/expense writes that attach an event must similarly coordinate by writing the event version within their transaction. This avoids new references appearing while an event is being deleted. At this personal-use scale the added contention is acceptable. 

## **Key atomic operations** 

- Provision: allocate account/wedding IDs, insert both with reciprocal references; uniqueness prevents a second wedding for the account. 

- Complete setup: condition on wedding version, insert missing presets, set presetsSeededAt and complete status in one transaction. 

- Family create: insert family and selected eventInvitations after verifying wedding ownership. 

- RSVP: lock family and event, verify current assignment/status/count, then conditionally update invitation using expected version. Increment version and set respondedAt. 

- Count reduction: lock family, verify no attendingCount exceeds the new count, then update. Reject inconsistent reductions. 

- Assignment replacement: lock family and affected events, delete removed invitations/RSVPs after confirmation and insert new pending invitations. 

- Password reset: consume token and coordinate via account authVersion; update password and revoke sessions atomically. 

## **Deletion effects** 

Event: lock event, delete invitations, unset eventId on tasks/expenses, delete event. Preserve expenses and task records. 

Family: lock family, delete its invitations and guest sessions, then delete family. Existing links immediately fail subsequent access checks. 

Task/expense: delete the scoped record with expected version after confirmation; refresh computed summaries. 

OneDrive setting: unset link only. No external file or permission changes occur. 

There is no soft-delete field or product trash. Database backups may retain deleted records until their retention expires. 

## **Retry and stale-write policy** 

Database transient conflicts receive bounded retries. A stale expected version returns conflict and current safe state for user review. Network retries on create use idempotency. Never report success before commit. No external storage cleanup is part of these transactions. 

MAKE MY MARRIAGE | DATABASE DESIGN v1.0 

8 

# **8. Query patterns and example records** 

## **Guest invitation query** 

Resolve session by tokenHash -> validate expiry/version/family -> use weddingId and familyId to list eventInvitations -> join only published events with matching weddingId -> project safe fields. 

Never populate an unscoped foreign reference and return it directly. A missing/deleted event is omitted and treated as inconsistent data for operator review, not permission to show other records. 

## **Dashboard queries** 

Families: count documents and sum invitedCount within weddingId. Invitations: group by eventId and status; sum attendingCount only for attending rows. Published-event views exclude draft events. 

Expenses: match weddingId, sum amountPaise overall and group by payerKey/eventId. Missing eventId becomes an Unassigned category. Tasks: count pending/completed; overdue matches pending and dueDate before today's local date. Upcoming events sort by startsAt with _id as tie-breaker. 

Separate dashboard queries may reflect slightly different instants during concurrent edits; refresh after mutations. Critical financial export is not part of version 1. Never interpret summed per-event attendance as unique people. 

## **Example household and invitations** 

Family: {_id:F1, weddingId:W1, name:'Sharma Family', searchName:'sharma family', phoneE164:'+919876543210', invitedCount:5, tokenVersion:1, revision:3}. 

Wedding invitation: {weddingId:W1, familyId:F1, eventId:E1, status:'attending', attendingCount:4, version:1}. 

Reception invitation: {weddingId:W1, familyId:F1, eventId:E2, status:'attending', attendingCount:3, version:1}. 

There is no invitation row for haldi, so the family does not see haldi. This represents one household with independent event attendance, not seven unique guests. 

## **Example expense and cutoff** 

Expense: {weddingId:W1, description:'Decoration advance', amountPaise:1250000, spentOn:'2026-12-01', payerName:'Groom', payerKey:'groom', eventId:E1, idempotencyKey:'client-generated-uuid', version:0}. Display amount: INR 12,500.00. 

Wedding: {weddingDate:'2026-12-10', timezone:'Asia/Kolkata', photoVisibleUntil:Date('2026-12-16T18:30:00Z')}. Folder redirect requires now < photoVisibleUntil and an existing approved URL. 

## **Pagination and search** 

Use bounded page sizes; 50 families is a useful initial default. For larger event/expense lists use stable date + _id ordering. Escape text search input. All aggregate pipelines start with an ownership match and restrict joined data to the same wedding. 

MAKE MY MARRIAGE | DATABASE DESIGN v1.0 

9 

# **9. Lifecycle, deployment and verification** 

## **Data lifecycle and backup** 

Keep wedding planning and RSVP data until explicitly deleted. Only authentication and rate-limit records expire automatically. Hide the folder button after seven days; the couple separately saves photos, revokes sharing and deletes files in OneDrive. No photo count, file type enforcement or automated OneDrive deletion exists. 

Select an Atlas backup mechanism before production. Proposed operational target: daily recoverable backups and restoration within one day. Test restoration into an isolated database. Product deletion is permanent even though backups can retain historical copies temporarily. 

## **Mongoose and release practices** 

Reuse a cached connection promise per warm Next.js runtime; use Node.js runtime. Separate development, preview and production databases and least-privilege credentials. Store secrets server-side only. 

Validate input before queries; allowlist update fields and reject MongoDB operator injection. Enable update validators where relevant, but do not rely on them for cross-document constraints or untouched fields. Model services implement the invariants. [2] 

Maintain migration scripts with versioned execution records or an operator-controlled run log. Make scripts idempotent and test on a restored copy. Confirm backups, repair duplicates, apply indexes, then deploy compatible code. Do not log connection strings, credentials or bearer tokens. 

## **Required verification** 

- Unique account/wedding relationship; setup retries seed exactly six presets once. 

- Duplicate invitation rejection; optional token hashes and custom event preset fields do not collide. 

- Tenant-scoped CRUD and aggregation; guest queries exclude uninvited and draft events. 

- RSVP count validation, stale updates, assignment/deletion races and invited-count reductions. 

- Integer expense arithmetic, create replay/conflict handling and preserved spending after event deletion. 

- Session expiry before TTL deletion, reset single use, concurrent reset conflicts and token rotation revocation. 

- Cutoff before/at/after midnight IST, wedding-date edits and no TTL deletion of wedding data. 

- Rollback of partial multi-collection writes, no orphaned references and successful isolated backup restoration. 

## **Official technical references** 

Consulted 23 October 2026. Recheck implementation-specific configuration when selecting exact dependency versions. 

[1] Mongoose transactions: https://mongoosejs.com/docs/transactions.html 

Transaction sessions, retries and restrictions on parallel operations. 

[2] Mongoose validation: https://mongoosejs.com/docs/validation.html 

Schema/update validation and unique-index distinction. 

- [3] MongoDB partial indexes: https://www.mongodb.com/docs/manual/core/index-partial/ 

Conditional index membership and query compatibility. 

- [4] MongoDB TTL indexes: https://www.mongodb.com/docs/manual/core/index-ttl/ 

Eventual expiration cleanup; application expiry checks remain authoritative. 

## **Completion boundary** 

This document specifies the database for the agreed first version. It does not create an Atlas database, apply indexes, provision accounts or modify OneDrive sharing. Collection limits and security timeouts are engineering defaults and can be tuned without expanding product scope. 

MAKE MY MARRIAGE | DATABASE DESIGN v1.0 

10 

