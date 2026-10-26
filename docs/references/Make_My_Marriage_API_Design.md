 ## Make My Marriage

API Design Document

Version 1.0 | 26 October 2026 | Next.js + TypeScript

## Purpose and scope

HTTP contracts for the agreed PRD, architecture and database design. One provisioned shared couple account owns one wedding. Guests use family invitation links without accounts. This document does not implement or deploy endpoints.

Included: sessions, password reset, wedding setup, dashboard, events, tasks, expenses, families, invitations, event-wise RSVP, manual WhatsApp sharing, Maps, YouTube and external OneDrive access.

Excluded: signup, vendor discovery, bulk email, payments, individual guest profiles, photo uploads, R2 and Microsoft Graph. OneDrive handles photo storage, permissions and cleanup externally.

## Global conventions

Base path /api, same trusted origin as the web app. All requests and responses use camelCase JSON except 204 and redirects. Actual IDs are 24-character hexadecimal ObjectIds; examples use symbolic IDs. Timestamps use ISO UTC; weddingDate/dueDate/spentOn use local YYYY-MM-DD. Currency is INR, amounts integer paise.

Success: {data:resource,meta:{requestId}}. Lists: {data:[],meta:{requestId,page,pageSize,total}}. Errors:

{error:{code,message,fields?},meta:{requestId}}. fields maps field names to safe validation messages without echoing passwords or tokens.

Pagination: page defaults 1, pageSize defaults 50, maximum 100. Reject invalid filters. Stable sorts use _id tie-breakers. Search is capped at 100 characters and escaped. JSON writes require application/json; proposed body limit 64 KiB. Reject unknown fields, malformed JSON and operator injection. PATCH omitted fields stay unchanged; null clears documented optional fields only.

## Security

Use independent Secure, HttpOnly, SameSite=Lax, Path=/ cookies named __Host-couple_session and __Host-guest_session; no Domain attribute. Server stores token hashes only. Proposed absolute session lifetime seven days. Check subject, current version and expiry on every request.

Mutations require exact configured Origin and JSON content type; reject missing/cross-origin browser mutations. This is the same-origin CSRF defense; SameSite alone is insufficient. No mutations on GET. No cross-origin API use is supported.

Derive weddingId and familyId from authenticated actors, never writable inputs. Couple routes reject guest sessions.

Return safe 404 for foreign resources. Use private/no-store on protected responses, auth and photo redirects; no-referrer on secret/guest pages and noindex on invitations. Never log tokens, passwords or secret-bearing paths.


## 1. Authentication

## POST /api/auth/login | Public | 200

Body: {email,password}. Verify shared account credentials; issue an independent couple session per device. Return {account:{id,email},weddingId,setupStatus} in data, and Set-Cookie. Never return session token in JSON. Bad email/password returns identical 401 INVALID_CREDENTIALS.

## GET /api/auth/session | Couple | 200

Return {account:{id,email},weddingId,setupStatus,expiresAt}. Missing/expired session returns 401 UNAUTHENTICATED. Database TTL cleanup is never the access-control clock.

## POST /api/auth/logout | Cookie optional | 204

No body. Revoke current couple session and clear its cookie. Repeating succeeds. Does not clear independent guest sessions.

## POST /api/auth/forgot-password | Public | 202

Body: {email}. Generic data {message:'If the account exists, password reset instructions will be sent.'}. Same response for unknown email and provider delivery failure. Generate a hashed single-use token with proposed 30-minute life and send through Resend. Rate limiting can return 429.

## POST /api/auth/reset-password | Public | 204

Body: {token,newPassword}. Atomically consume valid unexpired token, replace password hash, increment authVersion and revoke all sessions/outstanding reset tokens. Clear couple cookie; require login again. Invalid/expired/used token: 400 INVALID_RESET_TOKEN.

## POST /api/auth/change-password | Couple | 204

Body: {currentPassword,newPassword}. Require current password; on success update password, revoke all couple sessions/reset tokens, clear cookie and require login again. Wrong current password: 400 CURRENT_PASSWORD_INVALID. Proposed password policy: 12-128 characters, no silent trimming.

## Access and throttling

No registration/account-list endpoint. Operator provisions account and wedding shell. Use shared MongoDB rate counters for login, reset and guest exchange; return 429 with Retry-After. Never rely on per-instance memory. Password hashes, token hashes and authVersion are never public DTO fields.


## 2. Wedding and dashboard

## GET /api/wedding | Couple | 200

DTO: id, setupStatus, groomName, brideName, weddingDate, venue, mapsUrl, timezone, templateKey, coverAssetKey, oneDriveFolderUrl, photoVisibleUntil, version, createdAt, updatedAt. Optional DTO values serialize as null. Only the couple receives the raw folder URL.

## PATCH /api/wedding | Couple | 200

Body example: {expectedVersion:0,setupStatus:'complete',groomName:'Arjun',brideName:'Priya',weddingDate:'2026-12-1 0',venue:'Wedding Hall, Pune'}.

Writable: setupStatus (draft to complete only), names, date, venue, mapsUrl, oneDriveFolderUrl. URLs accept null to clear. Names 1-100 characters; venue 1-500. Complete setup requires names/date/venue. timezone is fixed Asia/Kolkata; traditional template and cover are server/deployment managed.

First completion seeds six draft presets once in the same transaction. Recompute photoVisibleUntil with wedding-date edits. Return saved DTO. Stale expectedVersion returns 409 VERSION_CONFLICT.

## GET /api/dashboard | Couple | 200

Data: wedding {groomName,brideName,weddingDate,daysUntilWedding}; tasks {pending,completed,overdue}; expenses {totalPaise,currency}; guests {families,invitedMembers,familiesWithPendingRsvp}; eventAttendance []; upcomingEvents []; serverNow.

## Each eventAttendance row:

eventId,eventName,pendingFamilies,attendingFamilies,notAttendingFamilies,attendingMembers. Upcoming events: up to six future published events. daysUntilWedding uses local calendar dates (zero on wedding day, negative afterwards). overdue is a subset of pending.

Count familiesWithPendingRsvp using unanswered published assignments. Aggregate from source records, not cached counters. Attendance is per event, never a unique-person sum across ceremonies. Separate dashboard queries need not form a transactional snapshot; refresh after writes.

## GET /api/expenses/summary | Couple | 200

Filters payerKey,eventId,from,to as for expense list, without pagination. Return {currency:'INR',totalPaise,byPayer:[{payerKey,payerName,totalPaise}],byEvent:[{eventId,eventName,totalPaise}]}.

Summary covers all matched records, not the current list page. Missing event references appear as eventId:null/eventName:'Unassigned'. No reimbursement or settlement amounts.


## 3. Events and task planner

## Event DTO and read endpoints

Event: id,name,presetKey,status,startsAt,venue,mapsUrl,youtubeVideoId,version,createdAt,updatedAt. Optional fields are null. Status draft/published.

GET /api/events | Couple | 200. Filters status,from/to ISO instants,page/pageSize. Sort startsAt ascending, missing dates last, _id ascending.

GET /api/events/:id | Couple | 200. Return Event DTO or safe 404.

GET /api/events/:id/guests | Couple | 200. Filters status=pending|attending|notAttending and pagination. Rows: invitationId,familyId,familyName,invitedCount,status,attendingCount,respondedAt,version. Include unfiltered event summary in meta. Sort normalized family name/ID.

## Event writes

POST /api/events | Couple | 201. Body {name,status?,startsAt?,venue?,mapsUrl?,youtubeUrl?}. name required, 1-100 characters; draft default. Published requires date/time and venue. Parse supported YouTube URLs into video IDs. presetKey is not writable. Return saved DTO and Location.

PATCH /api/events/:id | Couple | 200. Same editable fields plus expectedVersion; validate entire resulting event. Null clears optional values only if publication invariants still hold. Reverting to draft hides guest access but retains invitations/responses.

DELETE /api/events/:id?expectedVersion=3 | Couple | 204. Frontend confirms deletion consequences. Transaction removes event and invitations, unsets eventId on tasks/expenses and preserves those records. Stale version: 409; foreign/missing: 404.

## Tasks

DTO: id,title,assigneeName,dueDate,eventId,status,completedAt,isOverdue,version,createdAt,updatedAt. Status pending/completed; assignee is text, not an account.

GET /api/tasks | Couple | 200. Filters status=pending|completed|overdue,eventId=ObjectId|unassigned,page/pageSize. Sort dueDate ascending (missing last), _id ascending. Overdue is pending with dueDate before today's IST date.

GET /api/tasks/:id | Couple | 200. Return DTO.

POST /api/tasks | Couple | 201. Body {title,assigneeName,dueDate?,eventId?}. title 1-200 chars, assignee 1-100; initial pending. Validate local due date and wedding ownership of event. Return DTO and Location.

PATCH /api/tasks/:id | Couple | 200. Body includes expectedVersion plus editable title,assigneeName,dueDate,eventId,status. Optional dueDate/eventId accept null. Set completedAt on completion; clear on reopening. Do not reset completion time for an unchanged completed status.

DELETE /api/tasks/:id?expectedVersion=1 | Couple | 204. Permanent removal. CompletedAt and isOverdue are read-only. Task assignment sends no notifications and grants no access.


## 4. Expenses and families

## Expense endpoints

DTO: id,description,amountPaise,currency,spentOn,payerName,payerKey,eventId,version,createdAt,updatedAt. Integer paise; currency fixed INR.

GET /api/expenses | Couple | 200. Filters payerKey,eventId=ObjectId|unassigned,from/to inclusive local dates,page/pageSize. Sort spentOn descending,_id descending. GET /api/expenses/:id returns one DTO.

POST /api/expenses | Couple | 201. Require Idempotency-Key UUID header. Body {description:'Decoration advance',amountPaise:1250000,spentOn:'2026-12-01',payerName:'Groom',eventId:'E1'}.

Require positive safe-integer amount, valid date, description 1-300 and payer 1-100 chars. Derive payerKey. Same wedding/key and canonical create payload returns existing record with 200 and Idempotency-Replayed:true. Different payload: 409 IDEMPOTENCY_CONFLICT.

Persist immutable createPayloadHash alongside idempotencyKey so replays remain recognizable after edits; this is a small database implementation refinement. Do not expose hash. Key is retained for record lifetime only; do not retry old successful creates after permanent deletion.

PATCH /api/expenses/:id | Couple | 200. expectedVersion plus description,amountPaise,spentOn,payerName,eventId. eventId:null clears association. Keys/hash/currency/payerKey are read-only. DELETE /api/expenses/:id?expectedVersion=1 returns 204. Each record has one payer; split purchases are separate contributions.

## Family reads and creation

Family DTO: id,name,phoneE164,invitedCount,hasInvitationLink,tokenVersion,revision,createdAt,updatedAt. Detail includes eventAssignments [{eventId,eventName,eventStatus,invitationId,status,attendingCount,respondedAt,version}]. Never return tokenHash.

GET /api/families | Couple | 200. Filters q,eventId,rsvpStatus,page/pageSize. rsvpStatus requires eventId. Sort normalized family name/ID. List omits full assignment arrays. GET /api/families/:id returns detail.

POST /api/families | Couple | 201. Body {name:'Sharma

Family',phoneE164:'+919876543210',invitedCount:5,eventIds:['E1','E2']}. name 1-150, valid international phone, positive integer count; eventIds unique and same wedding. Create family/pending assignments transactionally. Return detail and Location. Names/phones need not be unique.

PATCH /api/families/:id | Couple | 200. expectedRevision plus name,phoneE164,invitedCount. Count below existing confirmed attendance: 409 INVITED_COUNT_CONFLICT with safe conflicting invitation counts. Do not silently change RSVP.

DELETE /api/families/:id?expectedRevision=2 | Couple | 204. Delete family, assignments and guest sessions. OneDrive permissions remain external.


## 5. Assignments, invitation links and guest

## access

## PUT /api/families/:id/events | Couple | 200

Body {expectedRevision:1,eventIds:['E1'],confirmResponseRemoval:true}. Replace full assignment set: preserve retained rows, insert new pending rows, remove deleted assignments/responses. Removing responded rows without confirmation returns 409 RESPONSE_REMOVAL_CONFIRMATION_REQUIRED. Frontend confirms all removals. Return updated family detail/revision.

## POST /api/families/:id/invitation-link | Couple | 200

Body {expectedRevision:2,confirmRotation:true}. Confirmation optional for first generation. If token exists without confirmation return 409 LINK_ROTATION_CONFIRMATION_REQUIRED.

Return {invitationUrl:'https://app.example/invite/random-token',tokenVersion:2,revision:3}. Link is returned once. Only token hash is stored; later sharing requires the saved link or regeneration. Rotation invalidates old links and guest sessions. A lost response requires explicit regeneration, not plaintext recovery.

## POST /api/guest/exchange | Public bearer link | 200

Body {token:'family-link-token'}. Validate hash/family, issue restricted guest cookie and return {redirectTo:'/guest'}. Invalid/revoked token returns generic 404 INVITATION_UNAVAILABLE. Redirect path fixed; never accept a user-controlled return origin.

Invitation landing page performs same-origin POST, then replaces token-bearing URL with a clean guest page. Load no external media before exchange. Anyone holding the link can update that family's RSVP.

## POST /api/guest/logout | Cookie optional | 204

Delete current guest session/clear guest cookie only. Couple sessions remain independent.

## GET /api/guest/invitation | Guest | 200

Data: wedding {groomName,brideName,weddingDate,templateKey,coverAssetKey}; family {name,invitedCount}; events []; photos {available,openPath,visibleUntil,instruction}; serverNow.

Each event: id,name,startsAt,venue,mapsUrl,youtubeVideoId,invitation {id,status,attendingCount,version}. Return only assigned published events. No other family data, tasks, spending or folder URL.

photos.openPath is /api/guest/photos only when available, otherwise null. Exact instruction: Please upload wedding photos in JPEG format. Gallery access is shared across valid families regardless of event assignment.

## PUT /api/guest/rsvp/:invitationId | Guest | 200

Body {expectedVersion:0,status:'attending',attendingCount:4}. Only attending/notAttending accepted; pending is initial state only. Attending requires integer 1..invitedCount; notAttending requires zero.

Resolve ownership from session; no writable familyId/weddingId/eventId. Recheck assignment/publication and count transactionally. Return {invitationId,status,attendingCount,respondedAt,version}. Stale version: 409 with safe current response; deleted/unassigned/draft event: 404. Each event response is independent.


## 6. OneDrive and external sharing

## GET /api/guest/photos | Guest | 302

Recheck session, family token/version, current folder link and server time. On success return Location with approved OneDrive URL and private/no-store. It is read-only navigation, not a proxy. Missing link/past cutoff: 404 PHOTOS_UNAVAILABLE without URL. Expired session: 401.

Button cutoff: 00:00 Asia/Kolkata on weddingDate plus seven calendar days. Example: wedding 10 December, hide from 17 December midnight IST. Client uses serverNow/visibleUntil to hide an open page's button and refreshes on focus. Server redirect always enforces actual availability. No scheduled hiding job.

Website hides button only. Copied link, downloaded files or an open OneDrive tab remain outside its control. Couple manually saves photos, revokes sharing and deletes files. No file inspection or JPEG enforcement. No upload, photo-list or photo-delete APIs.

## WhatsApp, Maps and YouTube

Frontend uses generated invitation link, family phone and encoded text to open WhatsApp. Couple reviews/sends manually; no delivery status. Later reminders require a saved link or explicit rotation, which revokes previous links. No reminder scheduling endpoint or guest email batch exists.

Maps links are approved HTTPS URLs returned only for assigned events. YouTube URL input is parsed to a supported video ID; construct safe embed/direct URLs. No arbitrary iframe HTML or server fetching of user URLs. Public/unlisted videos may remain accessible outside the app; hiding a link is not provider access control.

Validate exact allowed hosts for Maps, YouTube and OneDrive. Do not accept arbitrary redirect targets or unsafe suffix lookalikes. External failures produce clear fallback/unavailable UI; do not promise third-party availability.

## Couple invitation preview

Render a preview from couple-authorized wedding/event/family detail. Label chosen family and show only its event subset. No guest session is required for preview. Do not expose management DTOs in guest HTML. No separate template CRUD is needed for one fixed traditional template.

## Operational boundaries

No public indexes, database or maintenance APIs. Operator scripts provision accounts and apply schema/index changes. Future scheduled maintenance would require a separate server credential. Resend key remains server-side; OneDrive and YouTube require no application upload credentials in this release.


## 7. Errors, concurrency and verification

## Status/error catalog

200 read/update/replay; 201 created with Location; 202 generic reset request; 204 delete/logout/password change/reset; 302 photo navigation.

400 VALIDATION_ERROR/MALFORMED_JSON/INVALID_RESET_TOKEN/CURRENT_PASSWORD_INVALID. 401 UNAUTHENTICATED/INVALID_CREDENTIALS. 403 ORIGIN_NOT_ALLOWED. 404 NOT_FOUND/INVITATION_UNAVAILABLE/PHOTOS_UNAVAILABLE. 405 METHOD_NOT_ALLOWED with Allow. 409 VERSION_CONFLICT/INVITED_COUNT_CONFLICT/IDEMPOTENCY_CONFLICT/confirmation errors. 413 PAYLOAD_TOO_LARGE. 415 UNSUPPORTED_MEDIA_TYPE. 429 RATE_LIMITED with Retry-After. 500 INTERNAL_ERROR. 503 SERVICE_UNAVAILABLE for database outage. [2]

Error example: {error:{code:'VERSION_CONFLICT',message:'This item changed. Refresh and try again.',currentVersion:2},meta:{requestId:'req_123'}}. Include current safe data only after ownership checks. Do not expose foreign records via conflicts.

## Version and transaction policy

expectedVersion applies to wedding/event/task/expense and RSVP writes. expectedRevision applies to family, assignments and link generation. Deletes use query preconditions rather than DELETE bodies. Values are nonnegative integers. Successful relevant writes increment versions.

Expense create replays use documented key/hash checks. Other creates are not guaranteed replay-safe: after ambiguous network failure refresh before resubmitting. Button disabling is not database duplicate prevention. Token generation repeats only as deliberate rotation.

Multi-collection writes use transactions. Family revisions and event writes coordinate RSVP, assignment/count changes and deletion. Event references on tasks/expenses coordinate with event deletion. External email side effects remain outside retryable callbacks. Return success only after commit.

## Required checks

- \- Method/body/type validation, Origin checks, shared throttling and no secret logging.

- \- Shared multi-device login, expiry before TTL cleanup, reset single-use and session revocation.

- \- Tenant/family isolation on all routes and aggregates; no draft/uninvited-event leakage.

- \- Setup seeds once; event deletion preserves expenses/tasks; permanent family deletion revokes access.

- \- RSVP limits, stale versions, count reduction and assignment/deletion races.

- \- Expense replay/conflict and integer totals; summaries independent of pagination.

- \- Cutoff before/at/after IST midnight, stale-page button and redirect denial; copied OneDrive links remain external.

## Technical references

- [1] Next.js Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route

- [2] MDN HTTP response status codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status

Consulted 26 October 2026. These support HTTP/runtime mechanics. This is a human-readable API specification, not an OpenAPI file or running backend.
