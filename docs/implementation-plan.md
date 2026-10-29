# Implementation plan

## Completed scope: repository foundation

- One root Next.js App Router application, TypeScript strict mode, @/* alias.
- Minimal static brand/tagline page, approved palette, system fonts, no invented product workflows.
- npm scripts for development, production, formatting, lint and type checking; one lockfile.
- README, environment example, ignore rules, and concise AGENTS.md.
- Existing reference documents preserved. No database/email dependency, connection, collection, API, session flow or fake persistence.

Verification results are recorded below. This milestone does not imply any product infrastructure is complete.

## Next milestones (each requires authorization)

1. Persistence: Mongoose connection boundary, concrete models, explicit safe index tooling and account/wedding provisioning scripts. Use isolated development data; verify transaction/index behavior on a replica set. No production connection or provisioning without authorization.
2. Access: Argon2id, custom couple/guest sessions, reset emails, Origin protection, shared throttling, tenant authorization. Test expiry, single-use reset, revocation and isolation.
3. Planning: wedding setup/presets, events, tasks, integer-paise expenses and dashboard. Test idempotency, concurrency and deletion preserving tasks/expenses.
4. Families: assignments, approved invitation UI, RSVP and individual email invitations. Test event visibility, count limits and assignment/deletion races.
5. External access/release: validated Maps/YouTube/OneDrive links, IST cutoff, approved Stitch UI, guest mobile/accessibility review, backup restoration and production configuration.

Add folders/dependencies when their implementation arrives. No scaffolding of empty modules, queue, scheduler, maintenance jobs or generic framework layers.

## Reference precedence and decisions before affected features

Confirmed user decisions override older references. Existing Markdown files supply the available baseline; PDFs were missing during inspection. Preserve originals and record refinements here until authorized documentation updates.

- No registration or app gallery despite the older PRD. OneDrive replaces upload/photo management; personal covers are deployment assets.
- Restrained visual direction and approved Stitch designs supersede traditional decoration. Resolve legacy traditional-v1/cover identifiers before invitation work.
- Add immutable expense createPayloadHash to support replay after edits.
- Add RATE_LIMIT_SECRET to future auth configuration for the database-specified HMAC keys.
- Hash-only invitation links are returned once. Reminders need the saved link or explicit rotation, revoking old links/sessions. Discuss any change before implementation.
- Exempt bodyless logout from JSON body requirements while retaining Origin checks. Correct the malformed API wedding-date example when documentation changes are authorized.
- Define internal family/event coordination version increments and stale-write responses before persistence workflows.
- Define local development cookie handling separately from production Secure __Host- cookies.
- Unset optional database values map to null DTO values; this is not a schema conflict.
- Choose reset sender, approved URL hosts, Atlas/preview isolation and backup/restore setup before release. OneDrive anonymous upload/view permissions need a guest-device check.

## Verification record

- npm ci: passed using the single package-lock.json, with no force/legacy-peer-deps flags; npm reported zero vulnerabilities.
- npm run format:check, npm run lint, npm run typecheck, npm run build: passed. Production build prerenders / as static content.
- Development and production HTTP smoke checks: 200, expected brand and tagline present. No environment file or external credentials supplied. Temporary servers stopped after verification.
- Four reference SHA-256 hashes unchanged through formatting and verification. Ignore rules exclude dependencies, build output and local environment files while retaining .env.example.
- Execution host: Node.js 22.11.0 and npm 10.9.0. Target remains Node.js 24.x; verification on that runtime is outstanding. npm prints engine warnings on this older host, and upstream Next.js lint plugins print ESLint 10 peer-range warnings. Actual lint and clean install pass without compatibility overrides.
- Sandbox blocked npm registry access and Node workspace-path resolution; successful installs/checks used approved execution outside the sandbox.
- Build root is explicitly the repository root. Automatic Next.js agent-rule rewrites are disabled to preserve concise repository guidance.
- No product tests or visual browser inspection were performed; this static milestone uses compile/static checks and HTTP content smoke checks. No feature infrastructure is represented as complete.
- No commit, push, external provisioning, production connection or deployment performed.

## Public homepage milestone (26 October 2026)

- Implemented the complete Stitch Desktop Home Page layout, with responsive desktop/mobile styling, local imagery and licensed self-hosted fonts.
- Added sample planning, invitation and RSVP displays; samples are read-only and clearly labeled. Attendance is per event. Removed unsupported private-stream and photo-sync claims.
- Section navigation, keyboard focus, skip link and reduced-motion handling included. Couple sign-in is explicitly unavailable until the access milestone.
- No authentication, database, business APIs, external integrations, dependencies, commits or deployment added.
- Next step: review the homepage with the user before authorizing another feature.

### Homepage verification

- Passed: npm run format:check, npm run lint, npm run typecheck, and npm run build after fixing narrow-screen hero tagline wrapping. The production build prerenders the homepage as static content.
- Sandbox execution encountered Windows Access is denied while SWC canonicalized the OneDrive project path. Typecheck and production build subsequently passed with approved execution outside the sandbox.
- An isolated verification copy also encountered Windows dependency-directory permissions. A temporary React SSR layout server was prepared, but browser/HTTP connectivity was unavailable; no successful visual or runtime verification is claimed.
- Desktop and mobile visual browser inspection remains outstanding.

## Couple login milestone (27 October 2026)

Authorized scope: Stitch couple-login UI, real account/session persistence, provisioning and index scripts, login/session/logout HTTP contracts, and a protected welcome page. Authentication owns the wedding shell only; remaining wedding fields/models and ceremony seeding are deferred to setup. Public pages retain credential-free rendering. No live Atlas database, real account, Resend sender or deployment is provisioned.

Implementation decisions:

- Use `mongoose`, `server-only`, `zod`, and `@node-rs/argon2` for the Node.js server boundary. Use `tsx` for operator/test scripts and `mongodb-memory-server-core` for an isolated real MongoDB test replica set. Retain npm and a single lockfile.
- Explicit index setup, no production autoIndex/autoCreate, lazy cached connection with a small pool, required unique/TTL index verification before login/provisioning.
- Argon2id (19 MiB, two iterations, one lane); opaque 32-byte random sessions with SHA-256 hashes and seven-day absolute expiry. Validate account version and reciprocal wedding ownership on every protected request.
- Resolve the local-cookie decision: HTTPS uses `__Host-couple_session` with Secure; loopback HTTP uses `mmm_dev_couple_session`. APP_ORIGIN is mandatory for mutations and cannot be inferred from Host. Only HTTPS or loopback HTTP is accepted.
- Bodyless logout remains Origin-protected and intentionally omits the JSON content-type requirement. No guest cookie is modified. Rotate the browser's previous couple session after a successful login; other devices stay signed in.
- Shared MongoDB rate buckets: 10 account attempts and 50 network attempts per fixed 15-minute window, pseudonymized with RATE_LIMIT_SECRET. Only Vercel's controlled forwarding header is trusted there; elsewhere use a global network bucket. No per-instance rate-limit memory.
- Operator commands read ignored .env.local, allow only explicitly named mmm_dev/mmm_test databases, and prompt invisibly for passwords. Provision reciprocal IDs transactionally. No public signup.
- Use native ESM next.config.mjs to avoid SWC-transpiling configuration; public routes remain static, workspace/session routes dynamic. No private DTO caching.
- The approved login layout is retained; fake credentials, concierge/terms placeholders and password-reset controls are not shipped. Password reset and guest exchange require separate future milestones.

Development setup and exact commands are documented in README.md. The public homepage links to /login; /workspace is a welcome/sign-out page, not a fabricated planning dashboard.

### Couple login verification and completion boundary

- Six independent authentication/security unit tests passed, plus nine integration tests against a real disposable MongoDB 8.2.6 replica set.
- Built-app HTTP test passed: public homepage and login page, local illustration, unauthorized workspace redirect, cross-origin rejection, actual sign-in, two workspace refreshes, session lookup, logout, and revoked access. Fixture accounts are test-only and the database/server are stopped after the test.
- Type generation and strict TypeScript checks passed. Production build passed with no live MongoDB or Resend configuration; public pages are static and auth/workspace routes dynamic. Final formatting and lint checks passed.
- Windows initially denied native MongoDB temporary-file renames; an ignored repository-local test data directory resolved it. Next.js TS-config/Turbopack path canonicalization also failed in the sandbox. Native ESM configuration plus supported Webpack dev/build scripts resolved compilation. Explicit generated-output access resolved prerender-folder permissions.
- Login's production HTTP behavior is verified on the installed Node.js 22.11.0 host. Target Node.js 24, Vercel native-module packaging, deployment hashing capacity and desktop/mobile visual browser review remain to verify before release.
- No real development Atlas database/account is configured. Application sign-in will remain unavailable until the user supplies local development configuration and explicitly runs the documented index/provision commands. Never substitute fixture credentials or an in-memory login.
- Next authorized feature should be wedding setup after reviewing this login milestone and configuring development data. Password reset, password change and guest authentication remain separate future work.

## Public signup scope change (27 October 2026)

The user explicitly authorized public signup, superseding the previous provisioned-account-only decision and the no-registration guidance for this feature. The older reference documents are preserved.

- Add /signup, discoverable from login, and POST /api/auth/signup.
- Require normalized email and matching 12–128 character passwords; store Argon2id hashes.
- Use the existing transactional account/wedding-shell creation and required unique indexes. Each new couple owns a separate wedding.
- Apply Origin checks, bounded JSON, strict validation and database-backed signup throttling in a separate namespace.
- Return no account IDs, hashes or session tokens. On success, direct the couple to sign in.
- Email ownership verification and password recovery remain unimplemented. Signup does not imply verified email ownership.
- Keep operator provisioning available for local administration. No additional dependencies or external services.

Verification: six unit tests, ten real-MongoDB integration tests, and a production HTTP end-to-end test passed. Signup, duplicate rollback, ownership and subsequent login are covered. Formatting, lint, typecheck and production build passed. Initial integration startup hit loopback EACCES before the network grant; the permitted retry passed. No test accounts were added to the configured development database. Visual review and Node.js 24 verification remain pending.

## Login design refresh (27 October 2026)

Applied the updated Stitch Interactive Couple Login screen 17829c30238f418dbc31ea468015fdf9: editorial gallery, image overlays, olive/ivory form styling, preview badges and sign-in/live-preview switch. Couple names personalize the browser-only preview; they are neither authentication inputs nor persisted wedding fields. The preview is explicitly illustrative and cannot authenticate or expose workspace data. Retained real sign-in, signup access and request validation. Omitted prototype-only successful-authentication claims, fabricated countdown/guest totals, prefilled credentials and unsupported reset/concierge/legal links. No API, schema or dependency changes.

Verification: formatting, lint, typecheck and production build passed. The production HTTP regression passed, including signup, login, protected workspace refresh, session lookup and logout against disposable local MongoDB. Browser rendered the refreshed page and images, but interactive and mobile visual verification remain pending: the isolated preview server could not be reached by the browser, and the existing development server already occupied the project. No running user server was stopped.

## Homepage design refresh (27 October 2026)

Applied the updated Stitch Refined Background Palette screen 412de8e8b2254709a5cef3f731adc5b9: warm ivory/sand palette, text brand, pill login navigation, compact snapshot and planning ledger, ceremonial essentials row, simplified invitation/attendance examples, connected-detail cards and sand closing panel. Homepage theme is scoped to home.module.css to preserve authentication styling. Login links retain real /login destinations.

All sample data remains illustrative/read-only. New essentials cards illustrate planned events/tasks/family workflows; they do not add astrology calculations, wardrobe inventory, room allocation, shagun registries or elder access roles. No passcode authentication, private/ad-free broadcast, automated sharing or cloud-vault guarantees are introduced. No API, persistence, dependency, secret or external-service changes.

Homepage refresh verification: format:check, lint, typecheck and production build passed; / remains statically prerendered. Existing built-app HTTP regression passed, including homepage, signup/login, protected workspace, session and logout with disposable local data. Desktop browser confirmed the updated page, loaded hero image, guest-experience anchor navigation and no horizontal overflow at 1280px. Mobile visual review remains pending.

## Wedding setup milestone (27 October 2026)

Authorized by the user to implement the new Stitch Wedding Setup (d65c6ec7913f48efa1bff580f2c8e7e9) and Setup Completed Overview (1e88292851774b758e7d3fde98030ac0) screens.

Scope and decisions:

- /wedding/setup saves and resumes drafts, completes setup, and edits completed details. /workspace redirects incomplete weddings to setup and shows persisted details plus actual seeded draft ceremonies when complete.
- Implement GET/PATCH /api/wedding with actor-derived ownership, exact Origin checks, bounded JSON, strict fields, safe DTOs, private/no-store responses and expectedVersion conflicts.
- Only groomName, brideName, weddingDate, venue and draft-to-complete setupStatus are editable here. A draft may omit or clear fields with empty strings; storage unsets absent values and DTOs serialize them as null. Completion and subsequent edits require all four essentials; complete cannot revert to draft.
- Wedding dates are validated local YYYY-MM-DD calendar dates, fixed Asia/Kolkata. Native date input provides locale-aware selection, replacing the prototype's ambiguous free-text format. The server derives photoVisibleUntil at midnight IST on weddingDate + seven days, including date edits.
- Wedding version update, completion marker and six draft presets commit in one transaction. Lock the expected wedding version before event insertion so simultaneous completions yield a conflict, not duplicate presets. Completed edits never recreate deleted presets.
- Extend explicit db:indexes with events {weddingId,presetKey} unique and partial on string presetKey. No startup auto-indexing. Setup fails closed if the required index is absent. No event management API is included.
- Optional Maps/OneDrive settings remain deferred as discussed in the proposed setup milestone. Template/cover identifiers remain unresolved until invitation work; DTOs expose null for these unconfigured integration fields rather than claiming an installed traditional template.
- Retain the stationery form, editorial imagery, ivory/olive/bronze direction and saved overview. Omit prototype controls, sample account data, legal-registry/NDA/celebrity claims, invented concierge services and end-to-end encryption guarantees. Inputs are never written to browser storage; unsaved entries survive recoverable fetch errors only while the page stays open.
- Ceremony editing/publication, tasks, expenses, dashboard aggregation, invitations, guest access and external settings remain future milestones. No new dependencies, commits, pushes, production changes or deployment.

Wedding setup verification: eight real-MongoDB setup tests, ten authentication integration tests, six security/unit tests and the expanded production HTTP test passed. Tests cover draft resume, completion, actual overview data, edits, stale/concurrent updates, missing preset indexes, rollback and isolation. Formatting, lint, typecheck and build passed. Explicit application indexes were applied successfully to the configured development database; no account or wedding data was created there. Browser access to the isolated visual fixture timed out; desktop/mobile interactive review and Node.js 24 verification remain pending.

Final setup build note: ordinary npm run build passed earlier in this milestone, but later Windows/OneDrive verification attempts hit EPERM while creating generated .next prerender/chunk directories. The same Next.js webpack production build passed when an ignored local verification helper precreated only those output directories after build cleanup. No application compiler settings or security boundaries were relaxed. Generated-folder permissions remain an environment limitation. Protected wedding pages/API also receive explicit private/no-store, no-referrer and noindex headers.

## Existing ceremony editing and publishing (28 October 2026)

Authorized scope: the six existing seeded ceremonies only. Stitch Ceremony List Desktop dacb3b06c0104f1489ae3e372f1aab90, Mobile 7415433fb7134e4f88991622d20ae63e; Edit Ceremony Desktop 73e0e8310da5435db3d7a35c963cf71b, Mobile f3b747d6af2b4b63a12e5bde8692e43f.

- /ceremonies lists actual saved records in Engagement, Haldi, Mehendi, Sangeet, Wedding, Reception order, with local All/Published/Draft filtering, live counts, IST timing, venue and readiness states.
- /ceremonies/[id] edits name, local date/time and venue. GET /api/events and GET/PATCH /api/events/[id] return explicit DTOs; unsupported POST/DELETE methods remain unavailable.
- This bounded preset-only list supersedes the reference's chronological UI ordering for this authorized milestone. General API pagination/date/status query filters and custom-event listing are deferred. Query parameters are rejected rather than silently ignored.
- PATCH accepts expectedVersion plus name/status/startsAt/venue only. Name is always required, 1–100 trimmed characters. Venue is at most 500 characters and may be cleared with null in draft. ISO instants are validated and normalized to UTC; local form date/time is interpreted in Asia/Kolkata.
- Date and time form one optional instant: enter both or leave both empty for an untimed draft. Partial date-only or time-only entries are not silently discarded. Preserve an unchanged existing instant, including seconds, when editing other fields.
- Publishing or editing a published record validates the entire resulting event. Name, instant and venue are required. Moving to draft changes status only and preserves saved details; confirmation warns if unsaved edits will be discarded.
- Atomic version-conditioned updates reject stale or simultaneous losing writes with 409 VERSION_CONFLICT. Reloading latest values requires confirmation and replaces unsaved local edits. Recoverable failures retain entries in the open page; no browser persistence or invented device/actor audit metadata.
- In-app link/sign-out navigation and browser unload warn for unsaved edits. The editor uses a native modal dialog for move-to-draft, with keyboard focus, Escape cancellation and a safe Keep published action.
- Access requires authenticated reciprocal wedding ownership and completed wedding setup. Foreign/malformed IDs return safe 404s. Mutations retain Origin/JSON/body-size checks, strict input validation and safe private/no-store DTOs.
- The wedding overview now displays actual status/timing/venue and links to management. Publishing does not dispatch invitations, grant family access, or send notifications.
- Omit prototype inspectors/state selectors, Add/Delete controls, vendor/run-of-show links, fake audit records, private stream claims and unsupported concierge functions. No Maps, YouTube, guest assignments, RSVP, custom ceremonies, deletion or dependencies are added.

Ceremony milestone verification: eight real-MongoDB ceremony/API tests, eight wedding setup regressions and the expanded built-app HTTP test passed. Format:check, lint, typecheck and ordinary npm run build passed. The production HTTP check covers actual list/editor pages, publication failure/success, persisted rendering, stale writes, move-to-draft preservation and 405 responses for creation/deletion. Desktop/mobile interactive browser review and Node.js 24 verification remain pending. No migration or live development data mutation was needed.

## Add and delete ceremonies (28 October 2026)

Authorized extension of the preceding preset-only milestone. Design: Stitch project 17821977374160587101, Ceremony List & Management Desktop b1d2c0528a114b0faff0211f6574143a. Implement its responsive card grid, add form, custom editor, delete confirmation and recovery states; omit prototype state selectors and unsupported integrations.

- POST /api/events creates private custom drafts only: required trimmed name (1–100), optional ISO startsAt and venue (max 500). Forms require date and time together, interpreted in IST. Custom ceremonies use existing editing/publication rules. List and overview show fixed preset order followed by custom creation time/id; no chronological reordering or reseeding deleted presets.
- Require UUID Idempotency-Key, store only its SHA-256 hash and a canonical payload hash, hidden from DTOs. Explicit db:indexes adds a partial unique weddingId/createKeyHash index; creation fails closed without it. Same key/payload returns the existing record, changed payload returns 409. Deduplication lasts for the record lifetime; there is no independent receipt/tombstone collection or promise of replay after deletion. Different keys may intentionally create identically named ceremonies.
- DELETE /api/events/[id]?expectedVersion=n is bodyless and authenticated, Origin-protected, strict and tenant-derived. A transaction locks the expected event version, deletes invitation documents (including RSVP data), unsets eventId on tasks/expenses with version and updatedAt updates, and deletes the event. Any cleanup failure rolls back all writes. Future reference-creation writers must acquire the event write lock/version in their own transaction to avoid orphan races. Native cleanup operations do not introduce speculative feature models or APIs.
- Delete can target presets or custom events. Accessible confirmation shows the saved ceremony snapshot, irreversible consequences, a safe Keep ceremony action, published warning and unsaved-editor warning. Stale records require load-latest and fresh confirmation; missing records offer return-to-list. No undo, notification dispatch, family/task/expense feature UI, external services, new dependencies, commits, pushes or deployment.
- Forms retain entries after recoverable failures, prevent duplicate submission, warn on unsaved navigation and handle session expiry. Explicit safe DTOs/private response headers and existing publication rules remain in effect.

Completed implementation and verification are recorded in project-status.md. Next: user review of add/edit/publish/delete on desktop and mobile, then separately agree the family-management milestone before implementing it. Invitations, RSVP, tasks and expenses remain deferred until separately authorized.

## Family management and ceremony assignments (28 October 2026)

Authorized by the user after approving the bounded feature plan and creating Stitch screens. Reference project 17821977374160587101: desktop 33e5b5966e5b486095604a692f22cced and mobile 85d7768b70994622bdb5b497e5190d07. Implement the desktop directory, mobile cards, real household/member totals, literal search, ceremony filter, add/edit forms, confirmations and recovery states. Adapt missing form screens using existing application form/dialog styles. Omit prototype state previews, invented allocation caps/progress, second contact-name fields, outbound invitation controls and unsupported Guests navigation.

- /families, /families/new and /families/[id] require couple ownership and completed setup. Add workspace navigation. Forms use required name (trimmed 1–150), optional validated invitation email and positive safe-integer invitedCount; ceremony assignments are optional and may include drafts. Names/emails are deliberately not unique. Adding a family creates no guest account and sends nothing.
- Follow reference GET/POST /api/families, GET/PATCH /api/families/[id], bodyless DELETE with expectedRevision, and PUT /api/families/[id]/events. API lists return data arrays with page/pageSize/total in meta; q is escaped, bounded at 100 characters, and pagination defaults 50/max 100. RSVP-status filtering remains deferred with RSVP UI. Directory DTOs add compact assignedEvents (id/name/status), not full invitation/response arrays; meta.summary gives unfiltered household and invited-member totals. This small read extension supports the approved list without exposing raw models.
- Family detail exposes explicit safe DTOs with assignment statuses/counts for consistency checks; tokenHash is excluded and only hasInvitationLink is returned. No token-generation API exists. Index tooling adds family search index, partial unique token hash index for the reference schema, and required unique {weddingId,familyId,eventId}. Creation and assignment writes fail closed without the assignment index. No automatic startup indexes or new packages/services.
- Canonical association collection is eventInvitations, as specified by the references. Replace the previous speculative invitations cleanup target and its fixtures; no family/invitation write feature existed before this milestone, so no data migration or legacy storage path is introduced. Ceremony deletion removes canonical rows and advances affected family revisions in the same transaction, alongside existing task/expense unlinking.
- Create family and pending assignments in one transaction. Assignment replacement locks the expected family revision, locks selected events in stable ID order by advancing event versions, verifies tenant ownership, preserves retained rows/responses, inserts pending additions and confirms responded removals before deleting them. These event locks coordinate with deletion; an assignment change may correctly invalidate an already-open ceremony editor version. Future RSVP/link writers must coordinate through the family revision as specified in the references.
- Detail changes use expectedRevision and reject invitedCount below existing confirmed attendance, returning a safe minimum count in the error message. Family deletion locks expectedRevision and removes the family, assignments/responses and guest sessions transactionally, preserving other families and ceremonies. Missing/foreign records return safe 404s; stale edits/deletes return 409.
- UI deliberately separates Save details and Save ceremony assignments so request results are unambiguous. Removal confirmation names removed ceremonies; permanent deletion shows the saved family/count, consequences and Keep family action. Stale deletion requires load-latest and fresh review. Forms retain entries on recoverable failures, prevent duplicate submission, handle expired sessions and warn on unsaved navigation/unload. An uncertain creation response blocks blind retries and directs the user to inspect saved families; no creation idempotency receipt is promised.
- Protected routes retain private/no-store, no-referrer and noindex, strict request fields, bounded JSON and exact Origin protection. Wedding/family ownership comes from the authenticated actor. No real development fixture records, production access, invitation links, guest exchange, RSVP writes, invitation-email delivery, imports, analytics, tasks/expense UI, commits, pushes or deployment.

Verification and remaining environment limitations are recorded in project-status.md. Next milestone: user review of the family flow, then separately plan secure invitation links and the guest invitation page. Event-wise RSVP follows that milestone; do not start either without authorization.

## Email-only invitation direction (28 October 2026)

User decision: use individual email invitation links as the sole planned invitation-sharing channel. The user explicitly requested repository-wide wording changes, including the reference documents; this supersedes the previous contact/channel descriptions while preserving unrelated scope and architecture.

Completed in this change: replace the family contact contract with optional email throughout add/edit/list/search, validation, persistence, safe DTOs and HTTP fixtures. Email is trimmed/lowercased, max 254, nullable; omitted PATCH values stay unchanged and null/blank clears the address. Separate households may share an email. No provider-specific dot/plus rewriting. Missing email on existing records returns null and remains editable. No live-data conversion, deletion or migration is performed; existing stored contact data is retained but excluded from the current DTO and UI. No new indexes, dependencies or credentials are required. Homepage copy identifies invitation-email delivery as planned, rather than presenting a working send action.

Updated PRD, system/database/API references, README, repository guidance and environment-example comments to specify email invitations. These documents describe planned individual Resend sends, preview/confirmation, deliberate resend, provider acceptance versus delivery and safe uncertain-result handling. Saving a family never sends an email.

Still deferred: secure link generation/rotation, guest invitation exchange/page and the individual send/resend API. Before delivery implementation, finalize recipient/link validation, retry deduplication and failure semantics; then obtain approval for live sending and any public deployment. No bulk sends, scheduled reminders, guest RSVP writes, service provisioning, real outbound emails, commits, pushes or deployment in this change.

## Family save development-cache fix (28 October 2026)

Reported Save family failure after switching the contact schema to email. Read-only checks confirmed the configured development database is reachable and the required assignment index exists. Reproduced a cached-model failure in a disposable database: a development connection can retain the previous compiled Family schema across Next.js reloads and reject email as an unknown field, producing the generic availability response.

familyModels now replaces a cached Family model whose schema differs from the current module in non-production only. This refreshes compiled validation without changing stored records or indexes; production model caching is unchanged. A regression test simulates the outdated schema and creates a family successfully after refresh. This fixes a reproduced failure path; the user's original server exception was not available, so a successful retry in that running environment remains to be confirmed. No sending API or email-provider integration is introduced.

## Secure family invitations and individual email sends (28 October 2026)

Authorized by the user to implement the previously discussed link/guest-page/email milestone. The user later requested checking .env.local; diagnostics inspect setting presence/validity only, not secret values. No new invitation-specific Stitch screen exists in the connected project, so extend the existing approved ivory/olive family forms, cards and native confirmations. No new packages, external provisioning, real-recipient sends or deployment are authorized during implementation.

- Add /families/[id]/invitation and links from family list/editor. Couple-authorized preview shows the saved household, published assigned ceremonies, excluded draft notice, current-link entry/copy, explicit link replacement, email snapshot, confirmation, acceptance/failure/uncertainty and deliberate resend. Saving a contact never sends. Missing email/published assignment/configuration have actionable states; no fabricated delivery/open history. Secrets remain only in the open page and server memory, never browser storage.
- GET /api/families/[id]/invitation returns owned management data and latest attempt summary. POST /invitation-link accepts expectedRevision and explicit replace; conditionally updates family token hash/tokenVersion/revision and deletes guest sessions transactionally. Plaintext random 32-byte token is returned once. The implemented URL is /invite#token=..., deliberately superseding reference path-token URLs to prevent token-bearing server request paths/logs. No token-bearing redirects or external media before exchange.
- /invite parses and clears the fragment locally, then POST /api/guest/exchange uses exact Origin, bounded JSON, strict token syntax and HMAC-backed network/token throttling. Family revision locking coordinates exchange with deletion/rotation. A separate __Host-guest_session on HTTPS (mmm_dev_guest_session on local HTTP), HttpOnly/SameSite=Lax/Path=/ cookie has seven-day absolute expiry and only its hash is stored in the shared sessions collection. A dedicated guest model preserves couple session shape and kind isolation. POST /api/guest/logout closes only that guest session.
- GET /api/guest/invitation and /guest recheck session expiry, current family existence/tokenVersion/hash, completed wedding, assignments and published status on every read. Return an explicit guest DTO with names, date, invited count and assigned published event name/time/venue only; never contact email, other families, management data, token hashes, maps/gallery links, tasks/expenses or RSVP mutation controls. Lost/replaced/deleted links show a generic unavailable response. Couple preview does not require or create a guest session.
- POST /api/families/[id]/email-preview accepts expectedRevision, current token, UUID requestKey, confirmResend and confirmUncertainResend. Validate current family link and recipient, require at least one published assigned ceremony, and transactionally select one active immutable attempt with a new family revision. Replay the same preparation key only while that attempt/link remains current. Store snapshot data and full-payload SHA-256, not raw link/token, in invitationEmails. The directory never exposes these internal fields.
- POST /api/families/[id]/email accepts attemptId/token only. Validate ownership, current family/contact/link/origin/sender and published invitation content against the snapshot, then transactionally claim a one-minute lease and family revision. Provider calls run outside retryable transactions. Use the Resend HTTPS REST endpoint through native fetch with a 15-second timeout, one recipient and Idempotency-Key derived from attempt ID; no SDK/dependency or configurable provider URL. HTML escapes dynamic content and includes a text alternative. Do not return/log raw provider bodies, secrets, token paths or payloads.
- Accepted attempts replay local acceptance without another provider call. Failed/uncertain attempts reuse the immutable payload and key within 23 hours, conservatively below Resend's documented 24-hour window. Active leases reject concurrent callers; expired leases allow same-key recovery after a crash. Changed details/template/configuration fail closed and require new preview. New resends require confirmation/cooldown; unresolved previous outcomes require explicit duplicate-risk acknowledgement before a fresh attempt. An email already accepted cannot be recalled by link rotation/deletion; current in-app access is still revoked immediately. No guarantee of inbox delivery or open tracking.
- Add explicit index tooling for shared guest sessions and invitationEmails unique wedding/family/key hash. Require the guest-session unique/TTL, family token-hash and attempt-key indexes before security-sensitive operations. Email attempts have no automatic TTL; retain deduplication metadata until transactional family deletion removes it. Existing family model has a hidden active-attempt reference. Schema changes require development reload/restart; no startup index creation or automatic data migration.
- Server-only settings: RESEND_API_KEY, plain mailbox EMAIL_FROM, INVITATION_EMAIL_ENABLED=true and an actual public HTTPS APP_ORIGIN. Default live delivery is disabled; no email credentials are needed for link generation/local guest exchange/preview or build. Public origin must not be localhost or an IP literal. Verified sender ownership is a provider prerequisite, not a claim made by syntactic environment validation. Local and fixture configuration must never fall back to production keys/data.
- Keep private/no-store, no-referrer and noindex on management, guest and exchange routes. Unauthenticated management calls fail safely; guest cookies cannot authenticate couple routes or vice versa. No bulk send endpoint, schedules, queues, RSVP submissions, password-reset flows, external link/gallery integration, commits or pushes.

Documentation: [Resend send endpoint](https://resend.com/docs/api-reference/emails/send-email), [24-hour idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys), [verified sender domains](https://resend.com/docs/dashboard/domains/introduction). These are provider contracts checked during implementation, not a confirmation of this account's credentials or delivery.

Current configuration check: saved .env.local has database/auth settings only; no RESEND_API_KEY, valid EMAIL_FROM or invitation enable flag, and APP_ORIGIN is local. Read-only setup checks and non-destructive application index installation are permitted; real inbox delivery and public deployment remain pending user configuration/authorization. Record actual verification in project-status.md. Next: user UI review and configured, explicitly authorized single-recipient delivery test, then separately plan event-wise RSVP.

## Deployed sign-in diagnosis (29 October 2026)

The deployed origin mismatch was resolved, but sign-in still returns SERVICE_UNAVAILABLE with configuration:false. This does not identify a root cause. Added server-only allowlisted login-stage diagnostics for database connection, index checks, throttling, account lookup, password verification, wedding lookup and session creation. Client errors remain generic and raw dependency errors are discarded. No infrastructure, credentials, indexes or deployment were changed. Deploy this diagnostic change and inspect the stage before choosing a remediation; production index provisioning remains a separate unresolved operator boundary.
