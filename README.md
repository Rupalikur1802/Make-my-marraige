# Make My Marriage

Beautiful celebrations. Thoughtfully planned.

Repository foundation for a single Next.js App Router application. The public homepage now follows the approved Stitch desktop design, with responsive layouts and labeled sample planning, invitation and RSVP previews. Couple login, persistent sessions, logout, and a protected welcome page are implemented. Wedding setup with saved drafts, a completed overview and six draft ceremonies is implemented. Editing and publishing the existing ceremonies is implemented. Custom ceremonies, deletion, other planning features and external integrations remain deferred.

## Setup

Use Node.js 24.x and npm 10.9.0. The package manager is npm; package-lock.json is the only lockfile. Install a current Node.js 24 patch locally before development; no runtime installer is bundled.

The scaffold was initially verified on the available Node.js 22.11.0/npm 10.9.0 host. Node.js 24 verification remains required: the older host produces engine warnings. Next.js supports ESLint 10, but some bundled plugins still declare older peer ranges, so npm also prints peer warnings. Do not use force or legacy-peer-deps to suppress them.

```sh
node --version
npm --version
npm ci
npm run dev
```

Open http://localhost:3000. Stop the server with Ctrl+C.

No .env.local file or external credentials are required to view the public pages. .env.example documents the optional local authentication configuration. Public rendering and builds do not connect to MongoDB or Resend. Inter and Newsreader fonts and the Stitch imagery are bundled locally; builds and page loads do not need Google Fonts or Stitch access.

## Verification

```sh
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run start
```

Run the production server after building, with the development server stopped. Open http://localhost:3000 and confirm the brand and tagline render. Stop with Ctrl+C. Type checking generates Next.js route declarations before running tsc, so it works before a build. Lint is a separate check from the production build.

```sh
npm run format
```

Formatting excludes the existing reference documents and generated files. Authentication includes focused request/security tests and integration tests against a disposable local MongoDB replica set.

## Structure and conventions

- src/app: root layout, responsive public homepage, local fonts, and global palette/typography.
- docs/references: existing Markdown product and technical specifications, preserved as supplied. The four same-named PDFs requested during planning were absent.
- docs/implementation-plan.md: completed scope, next milestones, and deferred decisions.
- docs/project-status.md: ongoing major-feature progress, verification, and remaining work.
- AGENTS.md: concise repository guidance.

TypeScript uses strict mode, unchecked-index checks, and @/* mapped to src/*. Next.js configuration uses native ESM (next.config.mjs) to avoid transpiling configuration on Windows. Use plain CSS initially. Approved Stitch designs will guide the actual interface.

Future modules will own domain validation, services, persistence and explicit DTOs. Add them only with implemented features. Server Components should call services directly; route handlers adapt HTTP. Database/email/password code will be server-only and use the Node.js runtime. Validate service configuration only when needed, without global imports connecting to services. Development and preview credentials must never fall back to production.

Generated outputs, node_modules, local environment files, logs and reports are ignored. Commit source/configuration, next-env.d.ts and package-lock.json when a commit is explicitly authorized. Never commit credentials.

## Product boundaries

One shared couple account owns one wedding. Public couple signup is available; operator provisioning remains optional. Wedding is the tenant boundary. Guests use secure family links without accounts and see only assigned published events. MongoDB Atlas/Mongoose and custom couple sessions are implemented; Resend password resets are deferred.

Individual email invitations are planned as explicit one-family sends through Resend; delivery is not implemented yet; directions use Maps links; livestreams use YouTube. Photos stay in OneDrive, with JPEG requested as text. Hide website photo access at midnight Asia/Kolkata on weddingDate plus seven calendar days. The couple manually revokes sharing/deletes files; hiding the button cannot revoke a copied link. No application upload or photo collection is planned.

English, INR and Asia/Kolkata are the product defaults. No service has been provisioned or deployment performed.

## Homepage milestone

The homepage contains the hero, sample ceremony/task/spending overview, family invitation and RSVP examples, external-feature previews, and a closing couple-access section. Planning and guest navigation scroll to page sections; login links now open the implemented couple login page. Sample panels are read-only and do not save data. No external service or business API is invoked.

Design source: Stitch project 17821977374160587101, Desktop Home Page screen 8f547d0292f848f6bdd500335bba32e5. See public/images/README.md for asset provenance and src/app/fonts for font licenses. No new dependencies were added.

## Couple login: development setup

The Stitch Couple Login screen is at `/login`; successful sign-in opens `/workspace`, a protected welcome page. Homepage sign-in links now open `/login`. The public homepage and login screen still render without database credentials; a sign-in attempt fails safely with a generic service-unavailable response until configuration is ready. No sample or default login credentials are shipped.

1. Use an isolated MongoDB Atlas development database or a local MongoDB replica set. Transactions are required for provisioning. No external database has been created or contacted during this milestone.
2. Copy `.env.example` to `.env.local` and set `MONGODB_URI`, `MONGODB_DB=mmm_dev`, `APP_ORIGIN=http://localhost:3000`, and `RATE_LIMIT_SECRET`. Generate a random secret locally; do not put credentials in chat or Git. Non-production/preview databases must be named `mmm_dev`/`mmm_test` or begin with `mmm_dev_`/`mmm_test_`.
3. Run these commands in an interactive terminal from the repository root:

```sh
npm ci
npm run db:indexes
npm run account:provision
npm run dev
```

`account:provision` asks for the shared email and a 12–128 character password twice, with password input hidden. It creates the account and draft wedding shell in one transaction, without ceremony seeding. It refuses non-development database names and requires the index command first. Repeating an existing email fails without changing its password or creating another wedding. Index setup creates declared indexes without dropping data or synchronizing away unrelated indexes. Both operator commands are explicit and never run on application startup.

Open http://localhost:3000/login. After signing in, refresh `/workspace` to confirm persistence, then sign out. Both partners use the same credentials; each device has an independent seven-day session. Wedding ownership and account revocation version are checked on every protected request. Only token hashes are stored. Production HTTPS uses a Secure, HttpOnly, SameSite=Lax, Path=/ `__Host-couple_session` cookie. Local loopback HTTP uses a separate `mmm_dev_couple_session` cookie; HTTP origins outside loopback are refused.

The deployed origin must exactly match `APP_ORIGIN`; mutation requests with missing/foreign Origin are rejected. Login requests are JSON, at most 64 KiB, and reject unknown fields. Bodyless logout is the documented JSON-content-type exception. Authentication endpoints and private pages use no-store/no-referrer/noindex responses. Server-only boundaries keep database and hashing modules out of client bundles.

Login attempts use atomic MongoDB counters: 10 attempts per normalized account and 50 per network bucket in fixed 15-minute windows, including successful attempts. Keys are HMACs using `RATE_LIMIT_SECRET`; counters expire by TTL. On Vercel, only the overwritten `x-vercel-forwarded-for` header is trusted; other hosts share a conservative network bucket until trusted proxy handling is explicitly implemented. Authentication fails closed if required indexes are absent. Password hashing uses Argon2id with 19 MiB memory, two iterations and one lane; benchmark on the deployment runtime before launch.

### Authentication verification

```sh
npm run test:auth:unit
npm run test:auth
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test:auth:http
```

Unit tests cover password hashing, validation, request-origin/body protections, cookie policy, and missing configuration. Integration tests start their own real local MongoDB replica set, override environment configuration, provision only fixture accounts, verify transactions, multi-device sessions, expiry before TTL cleanup, tenant/revocation checks, logout and concurrent throttling, then stop the database. They never read `.env.local` or use an Atlas connection. First run downloads an official MongoDB binary (approximately 780 MB on this Windows host); binaries and fixture data stay under ignored `.cache/`. A normal terminal must allow native MongoDB file operations and local sockets.

The login milestone included: `POST /api/auth/login`, `GET /api/auth/session`, and `POST /api/auth/logout`. Password reset/change, guest sessions, wedding setup, dashboard data, Resend, and deployment are outside this milestone. The login design's fake prefilled credentials, concierge links and not-yet-implemented reset link were omitted.
The `dev` and `build` scripts use Next.js' supported Webpack option; Turbopack could not canonicalize this OneDrive path inside the Windows sandbox. `npm run typecheck` now works with native ESM configuration. The production build was verified without live credentials. `npm run test:auth:http` requires a completed build and starts/stops its own production server plus isolated MongoDB fixture; it exercises actual HTTP redirects, cookies, sign-in, refresh, and logout.

To generate a rate-limit secret locally, run `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` in your terminal and copy its output into your ignored `.env.local`. Do not reuse the test secrets.

## Couple signup

Open /login and choose **Create a couple account**, or open /signup. Use an email and matching passwords of 12–128 characters. After account creation, sign in to access /workspace. Each account owns a separate draft wedding. Email verification and password reset are not yet implemented.

Development setup still requires ignored .env.local configuration and `npm run db:indexes`. Run `npm run dev` to start locally. Operator account provisioning is optional.

The homepage was refreshed on 27 October 2026 from Stitch Refined Background Palette screen 412de8e8b2254709a5cef3f731adc5b9. Homepage styles are scoped in src/app/home.module.css. Planning, ceremonial essentials and attendance examples are read-only illustrations; they do not provision or implement future planning features.

## Wedding setup

After signing in, incomplete weddings open /wedding/setup. Save a partial draft and resume later, or enter both names, a wedding date and venue to complete setup. /workspace then shows the saved details and six draft ceremonies. **Edit wedding details** reopens the form. A stale edit returns a conflict; load the latest saved details before retrying. Unsaved form entries are retained only in the open page, not browser storage.

Run the non-destructive index command once after updating this feature:

```powershell
npm run db:indexes
npm run dev
```

The index command is limited to explicitly configured mmm_dev/mmm_test databases and now includes the partial unique ceremony-preset index. It never drops indexes or records. The existing development MongoDB deployment must support transactions (Atlas or a replica set).

Verification:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test:wedding
npm run test:auth
npm run test:auth:http
```

The HTTP suite requires the production build and now covers draft resume, completion, overview, stale edits and saved updates as well as authentication. Automated database tests create disposable local MongoDB replica sets and never load .env.local. First use may download the MongoDB binary.

Maps/OneDrive settings, invitations and full dashboard features remain deferred. Custom ceremonies and deletion are implemented in the later milestone below. Completing setup does not publish anything or contact guests.

Restart an existing development server after this model update so cached Mongoose models are reloaded before testing setup.

## Existing ceremonies

After wedding setup, choose **Manage ceremonies** in /workspace or open /ceremonies. Edit the six existing ceremonies, save partial plans as drafts, publish complete details, or move a published ceremony back to draft after confirmation. Publishing does not send invitations.

Date/time entry uses IST (Asia/Kolkata); both form one optional timing value. Supply both, or clear both to save without timing. Published ceremonies require name, date/time and venue. Conflicting edits return a safe conflict message and require loading the latest saved details before retrying.

Run `npm run test:events` for isolated database/API coverage. The existing `npm run test:auth:http` suite also verifies ceremony pages and publication over the built application; run `npm run build` first. Standard format:check, lint and typecheck commands remain unchanged.

The editing milestone added no dependencies or external services. The subsequent add/delete milestone below requires one additional non-destructive index. Maps/YouTube and guest invitations remain deferred.

## Add and delete ceremonies

In /ceremonies, choose **Add ceremony**, enter a name and optionally both date/time (IST) and venue. Creation always saves a draft; use the existing editor to publish when ready. Presets remain first in their fixed sequence; custom ceremonies follow creation order. Delete is available from each card and editor with a permanent-deletion confirmation. Deleted presets are never recreated by editing wedding details.

After pulling this model change, stop your existing development server, then run:

```powershell
npm run db:indexes
npm run dev
```

This adds the required partial unique {weddingId, createKeyHash} index to the configured development database without dropping records or indexes. No new packages or environment variables are needed. Creation fails safely if the index is missing. POST /api/events requires a UUID Idempotency-Key header; identical retries reuse the ceremony while it exists, and changed payloads with the same key return 409. The browser manages these keys automatically. DELETE /api/events/[id]?expectedVersion=n requires the saved version and has no body.

Deletion transactionally removes the ceremony and its invitation/RSVP documents, and clears eventId on linked tasks/expenses while preserving those records. These future modules have no UI or creation APIs in this milestone. Stale deletion requires loading and reviewing the latest saved details before confirming again. There is no undo.

Verify with npm run format:check, npm run lint, npm run typecheck, npm run build, npm run test:events, npm run test:wedding, and npm run test:auth:http (after build). Tests use disposable local MongoDB replica sets, not your configured development records. Explicit desktop/mobile interaction review and verification on the required Node.js 24 runtime remain pending.

## Families and ceremony assignments

After completing wedding setup, choose **Manage families** in /workspace or open /families. The directory supports literal name/invitation-email search, ceremony filtering and pagination, with actual household and invited-member totals. These totals are not confirmed attendance.

**Add family** saves a name (1–150 characters), optional invitation email address (validated, trimmed and lowercased, up to 254 characters), positive whole invited-member count and optional ceremony selections. Draft ceremonies may be assigned; future guest access will show only assigned published ceremonies. Duplicate names and email addresses are allowed for separate households.

In the editor, **Save details** and **Save ceremony assignments** are separate actions. Save each changed section before leaving. Removing assignments requires confirmation; existing responses on removed assignments are deleted and retained responses stay unchanged. Deleting a family permanently removes its assignments and any guest sessions. No invitation link, message, guest account or RSVP is created by this milestone.

Stop an existing development server before loading the new models. With the same ignored development environment configuration, run:

```powershell
npm run db:indexes
npm run dev
```

The non-destructive index command now includes family search/token indexes and unique wedding/family/event assignments in eventInvitations. It is still restricted to the configured development/test database. This command was applied successfully during implementation; there are no new dependencies or environment variables. Restart the development server to reload cached Mongoose models.

Verification commands:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test:families
npm run test:events
npm run test:wedding
npm run test:auth:http
```

The HTTP suite requires a completed production build. All database tests use disposable local MongoDB replica sets. If the local test process cannot connect to loopback, allow local networking in the execution environment. No live development accounts or family records are used by tests.

API scope: GET/POST /api/families, GET/PATCH /api/families/[id], bodyless DELETE /api/families/[id]?expectedRevision=n, and PUT /api/families/[id]/events. PATCH updates details; PUT replaces assignments. Lists use q (max 100), eventId, page and pageSize (default 50, max 100), return an array in data and pagination/overall household summary in meta, and include compact assignedEvents for the directory. RSVP-status filtering and invitation-link/guest APIs remain deferred. Foreign resources return safe not-found responses; stale writes require reviewing the latest saved values.

If creation cannot be confirmed after a connection failure, check the directory before adding the family again. Creation has no idempotency receipt; the UI blocks a blind retry after an uncertain response. Unsaved entries remain only in the open page. Explicit desktop/mobile visual review and target Node.js 24 verification remain pending.

## Invitation email direction

Family contact now uses optional **Invitation email** instead of a required messaging number. Add or edit an address in /families; search accepts family names or email addresses. Addresses are validated, trimmed/lowercased and may be cleared. Existing families without an email still open normally; their prior stored contact data is preserved and no longer exposed by the family DTO. No database migration or new environment variable is needed. Restart npm run dev to reload the updated Mongoose model.

The original contact-field change added storage only. The later invitation milestone below now implements secure links, guest invitation access and explicit email send/resend actions. The planned flow is preview, confirm and send one family-specific link through server-side Resend. It requires a verified sender and public HTTPS application URL before real recipients can use it; saving a contact sends nothing. Bulk sends and scheduled reminders remain excluded.

## Individual invitation links and emails

Open **Manage families → Manage invitation** for a family with a saved email address and at least one assigned published ceremony. Generate the private link, copy it, preview the invitation, prepare the email, then explicitly confirm sending. Saving a family does not send anything. Draft and unassigned ceremonies are excluded. Guest RSVP submission remains deferred.

Links use /invite#token=... so the token does not enter server request paths. The browser exchanges the token by same-origin POST for a separate HttpOnly guest cookie, clears the fragment and opens /guest. Guest access is restricted to the owning family and its currently assigned published ceremonies. Replacing a link revokes old links and guest sessions. Deleting a family also removes its guest sessions, assignments and email attempts.

Only token hashes are stored. Copy a newly generated link immediately; complete links cannot be retrieved later. On returning to the management screen, paste the retained current link or explicitly generate a replacement. Pasted links must match the configured app origin. Generating/replacing a link never sends an email automatically.

### Local setup and verification

With the existing ignored development database configuration:

```powershell
npm run db:indexes
npm run dev
```

Indexes include the unique family token hash, shared guest-session token/TTL indexes and unique per-family email preparation keys. The index command was applied to the configured development database during implementation, without creating invitation or family records. Restart the development server to load model/configuration changes. Local generation, exchange and preview work with the default localhost APP_ORIGIN and no email credentials.

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test:invitations
npm run test:families
npm run test:events
npm run test:wedding
npm run test:auth
npm run test:auth:http
```

The HTTP suite requires a build. All database tests use disposable local replica sets; the email adapter test redirects only its test fixture fetch to a local provider server. Test configuration explicitly disables real sends and overrides keys, sender and app URL. No test reads .env.local or sends an email to a real recipient.

### Enable real email delivery only when ready

Store these server-only values in ignored .env.local. Never paste a real key into documentation or a NEXT_PUBLIC_ variable:

```dotenv
RESEND_API_KEY=your_private_resend_key
EMAIL_FROM=invitations@your-verified-domain.example
INVITATION_EMAIL_ENABLED=true
APP_ORIGIN=https://your-actual-public-app.example
```

EMAIL_FROM is a plain mailbox address on your verified Resend domain. The example addresses/URLs are placeholders; use your real sender and deployed HTTPS origin. Keep APP_ORIGIN set to your actual localhost origin for local development: changing it to an unrelated public URL breaks same-origin mutation checks and does not publish the app. Publishing/deploying and a real-recipient delivery test require separate authorization. Resend setup requires a verified sender domain; see [verified domains](https://resend.com/docs/dashboard/domains/introduction). Credentials, a sender address and the explicit enable flag are checked lazily. Live sends are unavailable with a localhost/IP origin or missing settings; copying and preview remain available.

### Send and retry behavior

Preparation saves an immutable recipient/content snapshot and a digest of the complete provider payload, never the plaintext invitation token. Sending uses that saved preview and the current link; arbitrary recipients and URLs cannot be posted. Changed contact, family, wedding or ceremony details require a fresh preview. Sending one email is a separate action from preparing it or replacing its link.

Accepted means Resend accepted the request, not delivered/read/inbox placement. Failures and uncertain outcomes are shown separately. Repeated sends of the same accepted attempt return the recorded acceptance. Concurrent calls use a one-minute database lease and the same provider idempotency key; failed/uncertain retries reuse the exact payload for at most 23 hours. Resend retains its keys for 24 hours: [idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys).

A deliberate resend requires another preview/confirmation and at least a one-minute cooldown. An unresolved prior send requires checking status or retrying the same attempt; explicitly preparing another email acknowledges that the prior one may already have been accepted and the new send could duplicate it. Expired attempts are not automatically retried. Link replacement and family deletion immediately revoke in-app access but cannot recall an email already accepted by the provider. Email attempt metadata is retained until family deletion so accepted attempts are not silently forgotten. There are no queues, bulk sends, scheduled reminders, delivery webhooks or open tracking.

At implementation verification, the saved local file still lacked email credentials/sender/enable settings and used a local origin. Live Resend authentication, sender-domain verification and real inbox delivery were not performed. Desktop/mobile visual review and target Node.js 24 verification remain pending; automated HTTP tests do not establish those checks.

### Send and accept an invitation

Open Families, choose Manage invitation, enter the guest/family email and click Send invitation. The app saves the address, prepares the private invitation and submits one email. An existing lost link requires confirmation before replacement. Advanced manual link and preview controls are available under Invitation link and email details. A published assigned ceremony and configured server email delivery are still required.

The guest opens the email link and clicks Accept invitation. Opening alone does not accept. The couple refreshes Families or the invitation status to see Accepted with a timestamp. This is one family acknowledgement; it does not submit ceremony attendance counts. Email-provider acceptance is separate from guest acceptance and does not guarantee inbox delivery.

### Ceremony attendance (RSVP)

Guests open their private invitation and respond independently to each published assigned ceremony. Choose Attending with a whole-number count within the family’s invited limit, or Not attending (zero). Save each response separately. Responses can be edited anytime; invitation acceptance remains a separate acknowledgement. On a stale response, explicitly load the latest saved response before editing again. Guests never need an account.

Couples open /attendance from the wedding overview or family navigation, select a published ceremony and inspect confirmed guests plus attending, not-attending and pending family totals. Search and filters affect rows, while summary totals cover the whole selected ceremony. Family details show each response and its latest timestamp (IST). Refresh to retrieve changes; this version has no realtime updates or response deadlines.

Run npm run test:rsvp for isolated RSVP validation, ownership, race and aggregation checks. npm run test:auth:http verifies the built application guest-save/couple-summary flow with disposable database data and email sending disabled. No new database indexes or configuration variables are needed for RSVP beyond the existing guest/auth/assignment setup.

### Wedding dashboard

After completing wedding setup, /workspace shows your saved wedding details and IST countdown, family/invited-member totals, unique families with pending published-ceremony responses, separate invitation acceptance, upcoming published ceremonies and attendance by ceremony. Refresh dashboard to retrieve new responses. Confirmed guests are per ceremony; they are never added into a cross-ceremony guest total. Empty data and temporary service failures have separate states.

The dashboard, wedding details, ceremonies, families/invitation management and attendance use shared navigation and styling. Existing public/auth/guest pages keep their complementary visual direction. No additional environment variables or indexes are required. Tasks and expenses remain future milestones.

Verify with npm run format:check, npm run lint, npm run typecheck, npm run build, npm run test:dashboard and npm run test:auth:http. Dashboard tests use disposable local MongoDB data with email disabled. Use the documented Node.js 24 runtime for release checks. See docs/implementation-plan.md for the exact milestone boundary and docs/project-status.md for verification status.

### Guests and Invitation

Guests (/families) contains contact/member details, ceremony assignments and per-ceremony attendance. Open its attendance link for response filtering. Invitation (/families?section=invitations) contains email sending status, separate family acceptance, literal search, status filters and pagination. Open Send / manage invitation to preview, copy the private link, send or retry through the existing workflow. Browsing or filtering never sends an email. Status reflects the latest prepared attempt, not delivery or the full send history; recipient email is the current saved contact. Refresh invitations to retrieve new acceptance/status changes.

### Tasks and responsibilities

Open Tasks to create, edit or delete responsibilities assigned to Groom, Bride or Family. Titles are required; notes, due date and ceremony are optional. Tasks can be Pending, In progress or Completed. Overdue is derived from the current IST calendar date; completed tasks never appear overdue. Search/filter controls change the rows, while summary cards cover all tasks. The dashboard shows incomplete tasks ordered by due date and links to their editing forms.

After reviewing the intended database environment, install the new task indexes with npm run db:indexes. This operator command changes indexes; implementation does not run it against live data. Task creation requires the unique retry-key index. Run npm run test:tasks for disposable local MongoDB integration tests. Standard verification remains npm run format:check, npm run lint, npm run typecheck, npm run build and npm run test:auth:http. Creation retries reuse their UUID key while the task exists; after deleting a task, start a fresh creation. No email or notification is sent by task assignment.

### Expenses and recorded spending

Open Expenses to record money already paid. Enter a description, positive rupee amount (up to two decimals, no commas), date paid, Groom/Bride/Family payer and optional ceremony. Future payment dates are rejected using IST. Each shared purchase contribution is a separate entry. Search, payer/ceremony/date filters affect rows only; overview cards and ceremony breakdown cover the whole wedding. The dashboard shows total spending, payer contributions and the latest three payments.

Amounts are stored as integer paise and summed exactly. Same-key creation retries do not duplicate payments while the record exists. Editing uses version checks; conflicts require Load latest. Deleting a record does not refund or reverse a payment. Deleting its ceremony preserves it as Wedding-wide. There are no budgets, estimates, unpaid balances, receipts, payment processing or exports.

Use npm run db:indexes to install expense indexes in the intended mmm_dev/mmm_test environment; the operator refuses other database names. Production index installation needs a separately reviewed release process. Run npm run test:expenses for isolated integration tests, plus npm run format:check, npm run lint, npm run typecheck, npm run build and npm run test:auth:http. No new dependency or secret is needed beyond the existing server database/session configuration.

### Photos and Cloudinary

Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET and CLOUDINARY_PHOTO_PREFIX in ignored .env.local. Never expose the API secret through NEXT_PUBLIC_, logs or commits. The public cloud name/API key appear only where required for signed direct uploads. Empty examples are in .env.example. Use a stable unique mmm_dev_<id> or mmm_test_<id> namespace per isolated development/preview database; Vercel Production requires mmm_prod_<id>. Changing it after uploads hides earlier assets from that environment. Local credentials and namespace are configured; production configuration remains separate.

Open Photos in the couple sidebar. Select up to ten JPEG/PNG/WebP photos (10 MiB each), upload, and retry unfinished items individually or as a batch. Photos appear after automatic validation; keep your original files separately because incoming images may be resized and metadata is removed. Guests use Open wedding photos from their invitation. One gallery is shared across the wedding. Only the couple can delete or change Allow guest photo access; disabling it preserves photos and couple access. No automatic date cutoff applies.

No unsigned upload preset or public bucket is required. Authenticated originals/derivatives remain private, and browser image requests use authorized no-store app routes. Already viewed/downloaded bytes cannot be recalled. The app reserves 12 MiB per photo including previews, with 3 GiB per wedding and 6 GiB per namespace plus 20 new uploads per principal per 15 minutes. These limits do not guarantee free Cloudinary usage; transformations, bandwidth, other assets and Vercel media transfer also count. See docs/implementation-plan.md for direct-upload limits and privacy boundaries.

Run npm run db:indexes explicitly for development database collections/indexes (already applied to the configured local development environment). Run npm run photos:cleanup regularly to remove expired incomplete/deleting/tombstoned uploads, at most 100 per run; repeat for additional batches. Ready photos are never automatically deleted. Cleanup waits two hours for upload credentials to expire. Production cleanup uses npm run photos:cleanup -- --production in a separately reviewed operator environment with externally supplied production variables; it does not load .env.local. Establish production index setup, isolated provider namespace, usage monitoring and cleanup operations before enabling guest uploads. No scheduler is provisioned.

Verification commands: npm run test:photos, npm run format:check, npm run lint, npm run typecheck, npm run build, then npm run test:auth:http. Photos integration tests use disposable MongoDB data and provider mocks. No real invitation email is sent. See docs/project-status.md for confirmed results and pending review.
