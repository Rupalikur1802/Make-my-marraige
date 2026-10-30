# Project status

Last updated: 30 October 2026

This is the ongoing record of major features and milestones delivered in Make My Marriage. Update it whenever a major feature is built or materially changed, including its status, delivered scope, verification, and remaining work. Only mark confirmed work complete; record pending review and verification explicitly.

See [implementation plan](implementation-plan.md) for authorized milestone boundaries, future milestones, architecture decisions, and deferred questions. This progress record does not authorize additional implementation.

## Current overview

| Feature or milestone                             | Status                             | Remaining work                                                                      |
| ------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------- |
| Project scaffold and repository foundation       | Implemented                        | Verify on the target Node.js 24 runtime.                                            |
| Public homepage and design refresh               | Implemented; user review completed | Explicit mobile viewport verification remains unrecorded.                           |
| Couple login, sessions, and logout               | Implemented; user review completed | Node.js 24 and Vercel packaging verification.                                       |
| Public couple signup                             | Implemented; user review completed | Email verification and password recovery are deferred.                              |
| Login design refresh                             | Implemented; user review completed | Explicit mobile viewport verification remains unrecorded.                           |
| Wedding setup and ceremony seeding               | Implemented; user review completed | Explicit mobile viewport and Node.js 24 verification.                               |
| Existing ceremony editing and publishing         | Implemented; user review completed | Explicit viewport and Node.js 24 verification.                                      |
| Add and delete ceremonies                        | Implemented; user review completed | Desktop/mobile interaction review and Node.js 24 verification.                      |
| Family management and ceremony assignments       | Implemented; user review completed | Explicit viewport and Node.js 24 verification.                                      |
| Optional invitation email contact                | Implemented; user review completed | Real delivery requires sender/public URL configuration.                             |
| Secure invitations and individual email workflow | Implemented; user review completed | Sender/public HTTPS configuration and real delivery verification.                   |
| Ceremony-wise RSVP and attendance                | Implemented; user review pending   | Broader device, Node.js 24 and production verification.                             |
| Wedding dashboard and shared workspace           | Implemented; user review pending   | Broader device, Node.js 24 and production verification.                             |
| Separate Guests and Invitation views             | Implemented; user review pending   | Browser interaction, Node.js 24 and production verification.                        |
| Tasks and responsibilities — version 1           | Implemented; user review pending   | Production indexes, browser review and Node.js 24 verification.                     |
| Expenses and recorded spending — version 1       | Implemented; user review pending   | Browser visual review, Node.js 24 and production release verification.              |
| Shared wedding photos — version 1                | Implemented; user review pending   | Production configuration/cleanup operations, Node.js 24 and broader device testing. |

Couple signup, authentication, supporting persistence, and signup/login/session/logout APIs are implemented. Development database connection and index setup are verified. The user confirmed completion of code review and page-flow checks on 27 October 2026. Wedding setup and six draft ceremony seeds are implemented. Existing ceremony editing and publishing are implemented. Custom ceremony creation and versioned deletion are now implemented. Family management and ceremony assignments are now implemented. Secure invitation links, restricted guest sessions and individual invitation email workflows are implemented. Live delivery requires configuration and a real-recipient verification; Ceremony-wise RSVP, attendance summaries, the wedding dashboard, Tasks and Expenses version 1 are implemented; other planning/external features remain deferred. See the latest milestone records below.

## Latest review checkpoint (30 October 2026)

- The user requested review, a project-status update, and commit/push of the current RSVP/attendance, dashboard/navigation, invitation-directory, Tasks, Expenses and Cloudinary Photos changes.
- Reviewed tenant-derived ownership, guest session/ceremony restrictions, transactional coordination, creation retries, exact money handling and private photo access/cleanup. No actionable defects identified in this review.
- Pre-commit verification passed: npm run format:check, npm run lint, npm run typecheck, npm run build and all 141 automated tests (140 unit/integration regressions plus one expanded built-app HTTP flow). The regressions cover authentication, wedding setup, ceremonies, families, invitations/provider fixtures, RSVP, dashboard, tasks, expenses and Photos. Tests used disposable local data and fixture providers, with no real emails or live photo uploads in this verification run.
- The initial sandboxed build hit Windows/OneDrive EPERM while creating a generated .next directory. The identical build passed outside the sandbox without source/compiler changes. Earlier browser/provider verification remains recorded below; no additional visual review or live-provider probe was performed during this checkpoint.
- Implementation and earlier verification are recorded in the milestone sections below; architecture and scope remain in the [implementation plan](implementation-plan.md). This checkpoint does not claim new user visual approval.
- Target Node.js 24, production indexes/provider configuration, photo cleanup operations and release validation remain pending. This work does not provision services, change production settings, send real emails or perform a manual deployment.

## Previous review checkpoint (29 October 2026)

- The user accepted the current ceremony, family, optional email-contact and secure invitation features and authorized committing and pushing the changes to GitHub.
- Pre-commit verification repeated on 29 October 2026: formatting, lint, typecheck, production build and all 69 tests passed (16 invitation/provider-fixture, 14 family, 14 ceremony, eight wedding, ten authentication, six security/unit and one built-app HTTP test). Tests used disposable local data with no real emails. The sandboxed build encountered generated-directory EPERM; the same build passed outside the sandbox without source changes.
- This acceptance supersedes pending user-review notes in the historical delivery records below. Explicit desktop/mobile viewport coverage, Node.js 24/Vercel verification and real email delivery remain separate follow-ups.
- Live email delivery remains disabled pending verified sender/public HTTPS configuration and a separately authorized recipient test. This checkpoint does not enable sending, provision services or authorize deployment.
- Next feature: agree and authorize its scope in the [implementation plan](implementation-plan.md) before implementation.

## Previous review checkpoint (28 October 2026)

- The user confirmed that the wedding setup feature looks good and approved committing and pushing the milestone to GitHub.
- Wedding setup, saved overview/editing, and six private draft ceremony seeds are accepted for this milestone. Delivered scope and automated verification are recorded in the wedding setup section below.
- Pre-commit verification repeated on 28 October 2026: formatting, lint, typecheck, ordinary production build, eight wedding setup tests, ten authentication integration tests, six security/unit tests and the expanded built-app HTTP regression all passed. Database tests used disposable local data.
- Explicit desktop/mobile viewport coverage and Node.js 24/Vercel release verification remain unrecorded. General user acceptance does not establish those checks.
- Next feature: agree and authorize its scope in the [implementation plan](implementation-plan.md) before implementation. No additional feature or deployment is authorized by this checkpoint.

## Previous review checkpoint (27 October 2026)

- The user confirmed that code review and page-flow checks have been completed. This supersedes earlier pending user-review notes below, which describe the state at delivery.
- The implemented flow is homepage → login or signup → sign-in → protected workspace → sign-out. Signup creates the couple account and wedding shell, then directs the couple to sign in; the workspace remains a welcome page with wedding setup deferred.
- Existing automated verification covers signup, login, workspace access, session lookup and logout using disposable local MongoDB data. Historical test results are recorded with each milestone below.
- Pre-commit verification repeated on 27 October 2026: formatting, lint, typecheck, production build, six unit tests, ten MongoDB integration tests and one built-app HTTP flow test all passed on Node.js 22.11.0. Tests used disposable local data; no configured development records were created by these checks.
- Release follow-ups remain: target Node.js 24 verification, Vercel native-module packaging and deployment hashing capacity. Earlier records do not establish explicit mobile viewport verification; the user's general flow-review confirmation does not specify viewport coverage.
- Next feature: agree and authorize the wedding-setup scope in the implementation plan before implementation.

## Couple login, sessions, and logout

Status: Implemented; development database and indexes verified; user review completed on 27 October 2026.

- Built the existing Stitch Couple Login design with accessible labels, password visibility toggle, submission/loading/error states, and provisioned-account/guest guidance. Homepage login links open /login.
- Added server-only lazy Mongoose connection, account/wedding-shell/session/rate-limit collections, explicit non-destructive index setup, and interactive development-only account provisioning with hidden password input.
- Implemented POST /api/auth/login, GET /api/auth/session, POST /api/auth/logout, and the protected /workspace welcome/sign-out page. No fabricated dashboard data.
- Added Argon2id password verification, hashed seven-day per-device sessions, ownership/version/expiry checks, same-origin JSON validation, shared MongoDB throttling, secure HTTPS cookies and separate loopback-development cookies.
- Public homepage/login pages and builds remain usable without live credentials. No external service, real database/account, commit, push or deployment was created in this milestone.
- Verification: six unit tests, nine real-MongoDB integration tests and one built-app HTTP end-to-end test passed. Typecheck and production build passed. Final formatting/lint checks are recorded in the implementation plan.
- Remaining: verify explicit mobile viewport coverage and Node.js 24/Vercel packaging. Password reset remains a separately authorized feature.

See [implementation plan](implementation-plan.md#couple-login-milestone-27-october-2026) and [README](../README.md#couple-login-development-setup) for decisions and setup commands.

## Project scaffold and repository foundation

Status: Implemented.

- Created one root Next.js App Router application with strict TypeScript, the @/* import alias, npm, and a single package-lock.json.
- Added the initial static brand page, ivory/charcoal/olive styling, development and verification scripts, README, environment example, ignore rules, and repository guidance.
- Preserved the supplied product and technical reference documents.
- Kept the foundation runnable without credentials or external connections.

Verification recorded in the implementation plan: formatting, lint, type checking, production build, and development/production HTTP smoke checks passed. Reference document hashes remained unchanged.

Remaining work: verification on Node.js 24. The recorded checks used Node.js 22.11.0 and npm 10.9.0.

## Public homepage

Status: Implemented; refreshed on 27 October 2026; user review completed. See the latest review checkpoint and homepage design refresh below.

- Built the approved Stitch Desktop Home Page layout with responsive desktop/mobile styling, local imagery, and licensed self-hosted fonts.
- Added the hero, sample planning overview, family invitation and per-event RSVP examples, external-feature previews, and closing couple-access section.
- Included section navigation, keyboard focus, a skip link, and reduced-motion handling.
- Labeled sample displays as read-only. The later couple-login milestone connects homepage login links to /login.

Verification recorded on 26 October 2026: formatting, lint, type checking, and production build passed. The production build prerenders the homepage as static content.

Remaining work: user review and successful desktop/mobile visual browser inspection. Browser/HTTP connectivity prevented successful visual or runtime verification of this milestone; static checks do not establish visual approval.

## Local database connection check

27 October 2026: Moved the supplied MongoDB configuration to Git-ignored `.env.local` and restored a credential-free URI placeholder in `.env.example`. The server is reachable with network access, but Atlas rejects authentication (error 8000); the initial attempt did not create records or indexes. Follow-up: credentials were corrected and db:indexes subsequently succeeded against mmm_dev.

## Maintenance

27 October 2026: Fixed authentication integration and HTTP test setup to create the ignored `.cache` parent directory recursively before creating temporary database directories. This removes the fresh-checkout ENOENT failure. All ten authentication integration tests and the built-app HTTP regression passed against disposable local data; sandbox loopback restrictions required an approved retry for integration tests.

For each future major feature, add or update a section with the feature name, status, delivered behavior, actual verification results, and remaining work. Refresh the overview and last-updated date in the same change. Preserve existing milestone history and do not claim unperformed checks or deferred infrastructure as complete.

## Public couple signup (27 October 2026)

Implemented; automated verification passed; visual review pending. Added a signup page linked from login and transactional account/wedding creation with password confirmation, validation, hashing, Origin protection, unique email enforcement and database-backed throttling. Successful signup leads to sign-in. See implementation-plan.md for the explicit scope change overriding provisioned-only access. Email verification and password recovery remain deferred.

Development database follow-up: the corrected local configuration successfully connected to mmm_dev and npm run db:indexes completed. Account provisioning is no longer required for couples using signup. No real test account was created in the configured database.

Signup verification: six unit tests, ten real-MongoDB integration tests and one production HTTP test passed, including signup → login → protected workspace. Initial integration startup was blocked by sandbox loopback permissions; retry after network permission passed. Formatting, lint, typecheck and production build passed. Tests used disposable local data, not the configured development database. Desktop/mobile visual review and Node.js 24 verification remain pending.

## Login design refresh (27 October 2026)

Implemented; automated checks passed; interactive/mobile visual review pending. Fetched the updated Stitch Interactive Couple Login design and added its editorial gallery, local images, overlays, responsive form card and preview controls. Couple names update only explicitly illustrative preview content. Existing authentication and signup remain connected. See implementation-plan.md for prototype-to-product decisions and deferred features.

Login refresh verification: format:check, lint, typecheck and production build passed. Built-app HTTP regression passed for signup, login, protected workspace, session and logout with disposable local data. The browser rendered the refreshed layout/images; browser preview interaction and mobile review remain unverified because the isolated server was inaccessible and the existing user development server occupied the project.

## Homepage design refresh (27 October 2026)

Implemented; automated checks and desktop browser inspection passed; mobile visual review pending. Fetched Stitch Refined Background Palette and refreshed the homepage palette, navigation, planning ledger, ceremonial essentials examples, family invitation/attendance previews, detail cards and closing panel. Existing authentication links remain connected. See implementation-plan.md for the scope boundary and adaptations of unsupported prototype claims.

Homepage refresh verification: format:check, lint, typecheck, build and built-app HTTP regression passed. Desktop browser confirmed the updated hero image, section navigation and no horizontal overflow at 1280px; mobile visual review remains pending. No real development records, commits, pushes or deployments were created.

## Wedding setup (27 October 2026)

Implemented; automated verification passed; user review completed on 28 October 2026. Built the approved Stitch setup and completed-overview layouts with real draft persistence, completion/editing, field validation, conflict recovery, fixed IST date handling and six transactionally seeded private draft ceremonies. Login now leads incomplete weddings to setup; complete weddings see the saved overview. Explicit index tooling includes the required preset unique index.

See [implementation plan](implementation-plan.md#wedding-setup-milestone-27-october-2026) for API decisions, prototype adaptations and deferred features. Ceremony editing/publishing and external link settings are not included.

Wedding setup verification: eight setup tests, ten authentication integration tests, six security/unit tests and one expanded built-app HTTP test passed. Coverage includes real draft resume, completion/overview, saved edits, concurrent/stale updates, missing indexes, transactional rollback and tenant isolation. Format:check, lint, typecheck and production build passed. Applied non-destructive application indexes to the configured isolated development database; no account or wedding records were created there. The browser could not reach the isolated fixture server, so interactive desktop/mobile visual review remains pending. The fixture session was interrupted after that attempt.

Final build follow-up: Windows/OneDrive intermittently denied generated .next directory creation. The production build passed with local generated-directory preparation; no source compiler workaround was added. Ordinary npm run build had also passed earlier. Keep this environment limitation separate from the unperformed interactive visual review.

## Existing ceremony editing and publishing (28 October 2026)

Implemented; automated verification passed; interactive visual review pending. Added the approved responsive ceremony list/editor, saved status filtering, IST display/input, draft saves, publication validation, save feedback, stale-write recovery and confirmed move-to-draft preserving saved details. Wedding overview now links to management and reflects actual event details.

Implemented private GET /api/events and GET/PATCH /api/events/[id] with tenant ownership, strict fields and atomic version checks. No creation/deletion, invitations or external integrations. See [implementation plan](implementation-plan.md#existing-ceremony-editing-and-publishing-28-october-2026) for API boundaries and design adaptations.

Ceremony verification: eight isolated MongoDB/API ceremony tests, eight wedding-setup regression tests and one expanded built-app HTTP test passed. Formatting, lint, typecheck and ordinary npm run build passed without a new output-directory workaround. Covered IST boundaries, draft clearing, publication invariants, preserve-on-unpublish, concurrent/stale writes, ownership, request validation, private pages and unsupported create/delete methods. Interactive desktop/mobile browser review and target Node.js 24 verification remain pending; these were not performed for this milestone. No development records, schema migrations, deployments, commits or pushes were created.

## Add and delete ceremonies (28 October 2026)

Implemented; automated verification passed; interactive desktop/mobile review pending. Fetched the approved Stitch management design and built its card grid, custom draft creation, existing custom editor support, permanent deletion confirmation, session/error feedback, stale-record review and already-deleted recovery. Presets remain first and custom ceremonies follow creation order. Updated setup overview ordering and retained all prior edit/publication behavior.

POST creation is tenant-scoped and retry-safe while the record exists. DELETE is version-checked and transactional: invitation/RSVP cleanup, preserved but unlinked task/expense records, and event deletion commit together. See [implementation plan](implementation-plan.md#add-and-delete-ceremonies-28-october-2026) for exact contracts, idempotency lifetime, future reference-writer coordination and deferred modules.

Verification: format:check, lint, typecheck and ordinary npm run build passed. All 14 ceremony/API tests, eight wedding-setup regressions and the expanded production HTTP test passed against disposable real MongoDB replica sets. Coverage includes creation replay/concurrency, custom editing/publication, preset deletion without reseeding, tenant isolation, edit/delete races, cleanup rollback, strict request validation and end-to-end creation/deletion. The HTTP check caught an empty-stream DELETE handling failure; fixed it and reran the build, ceremony tests and HTTP suite successfully.

Applied the required non-destructive creation index to the configured development database using npm run db:indexes; no application records were created or deleted there for verification. Restart the development server to reload cached Mongoose models. No new dependencies, external services, commits, pushes or deployment. Interactive browser review remains pending because the isolated fixture server was inaccessible to the browser; automated HTTP checks do not establish visual correctness. Host verification used Node.js 22.11.0; required Node.js 24 verification remains pending.

Next: user review of the ceremony management flow on desktop/mobile, then agree a bounded family-management milestone before further feature development. No invitation dispatch, RSVP UI, task/expense UI or guest access was implemented.

## Family management and ceremony assignments (28 October 2026)

Implemented; automated verification passed; user and desktop/mobile interaction review pending. Fetched the approved desktop/mobile Stitch designs and built the responsive family directory, real totals, literal name/email search, ceremony filtering, pagination, family creation, separate detail/assignment saving, removal confirmations, permanent deletion and conflict/session/error recovery. The workspace links to Manage families. No invitation links, outbound invitation actions or guest/RSVP submission screens were added.

Persistence uses families and the reference eventInvitations collection with tenant-derived ownership and explicit safe DTOs. Transactional assignment changes coordinate with ceremony deletion, retain existing responses and validate confirmed attendance limits. Ceremony deletion now removes canonical assignments and advances affected family revisions. See [implementation plan](implementation-plan.md#family-management-and-ceremony-assignments-28-october-2026) for contracts, UI adaptations, retry limits and future coordination boundaries.

Verification: formatting, lint, typecheck, ordinary production build, all 12 family/API tests, 14 ceremony regressions, eight wedding regressions and the expanded built-app HTTP test passed. Tests cover tenant isolation, validation, optional/draft assignments, literal search/pagination, stale/concurrent changes, response preservation/removal confirmation, count conflicts, session cleanup, assignment/deletion races, transaction rollback and missing-index failure. HTTP coverage includes authenticated list/add/edit pages, family create/update, assignment replacement and bodyless version-checked deletion. Initial integration startup was blocked by sandbox loopback EACCES; the retry after network permission passed. Fixtures used disposable local MongoDB replica sets, never the configured development records.

Applied required family/assignment indexes through npm run db:indexes against the configured development database, without dropping indexes or changing application records. Browser inspection was attempted against a temporary isolated production fixture, but the in-app browser timed out reaching its loopback URL. The fixture then completed and stopped. Interactive desktop/mobile visual correctness remains unverified. The host runs Node.js 22.11.0; target Node.js 24 verification remains pending. No new dependencies, secrets, external services, commits, pushes or deployment. Restart the existing development server to reload model changes before user review.

Next: review family creation, details, assignments and deletion, then agree the secure invitation-link and guest invitation-page milestone. Event-wise RSVP remains a later milestone.

Family milestone final build follow-up: the last sandboxed build rerun encountered the existing Windows/OneDrive EPERM error creating a generated .next/server/app/signup directory. The same npm run build command passed outside the sandbox, without source/compiler workarounds. Earlier ordinary builds also passed during this milestone. Keep this intermittent generated-directory permission issue separate from application/compiler failures and pending visual review.

## Email-only family contact update (28 October 2026)

Implemented optional invitation-email contacts across the family form, list, literal search, validation, database schema and safe DTOs. Removed the previous required messaging contact from the current contract. Addresses are validated, trimmed/lowercased and clearable; existing records without email remain usable and no live contact data is deleted. Updated homepage wording, README, repository guidance, environment-example comments and the four reference documents at the user's explicit request. See [implementation plan](implementation-plan.md#email-only-invitation-direction-28-october-2026) for the superseding product decision and compatibility boundaries.

Email delivery, secure-link generation/rotation, guest invitation access and send/resend actions remain unimplemented. No real emails, database migrations, external provisioning, new dependencies, commits, pushes or deployment. Verification passed: npm run format:check, npm run lint, npm run typecheck, ordinary npm run build, all 13 isolated family/API tests and the expanded built-app HTTP regression. Coverage includes optional/malformed email, normalization, clearing, email search, existing records without email and preservation of prior stored fields. A repository text search found no remaining references to the retired invitation channel. Tests used disposable local MongoDB data; no real emails were sent. Explicit visual review and target Node.js 24 verification remain pending. Restart the development server to reload the model before review.

## Save family cache recovery (28 October 2026)

Implemented; automated verification passed; user retry pending. Investigated the reported Save family availability error. The configured development database and required assignment index passed read-only checks. Reproduced an outdated compiled family schema rejecting the email field after a development reload, then added development-only model recompilation and a regression test. Stored records and indexes are unchanged; production caching is unchanged. The original running server exception was unavailable, so user retry confirmation remains pending. See [implementation plan](implementation-plan.md#family-save-development-cache-fix-28-october-2026) for the scope and diagnostic limits. Email sending is still unimplemented.

Cache-recovery verification: formatting, lint, typecheck, ordinary production build and all 14 isolated family/API tests passed. The outdated-schema regression failed before the fix and passed afterward. The final built-app HTTP regression also passed, including family creation, email rendering/search, editing, assignment changes and deletion against disposable data. No live family records or outbound emails were created during diagnosis. Target Node.js 24 and interactive user retry remain unverified.

## Secure invitations and individual email workflow (28 October 2026)

Implemented; automated verification passed; user UI review and live delivery verification pending. Added Manage invitation from the family directory/editor, private link generation/replacement/copy, couple preview, personalized email preview, explicit send confirmation, accepted/failed/uncertain feedback and deliberate resend/retry. Added the public fragment-token landing page, separate restricted guest session and read-only personalized invitation showing only assigned published ceremonies. No RSVP submission or external gallery/maps/livestream actions were added.

See [implementation plan](implementation-plan.md#secure-family-invitations-and-individual-email-sends-28-october-2026) for exact API contracts, fragment URL adaptation, session/token boundaries, transaction coordination, one-recipient Resend adapter, immutable send records, duplicate prevention and retry limits. No new dependencies or SDK were installed. Saving a family never sends an email.

Verification completed so far: all 16 invitation tests, 14 family tests, 14 ceremony regressions, ten authentication tests and eight wedding regressions passed against disposable local MongoDB replica sets. The provider adapter was tested against a local HTTP fixture; no real emails were sent. Tests cover hidden plaintext tokens, cookie/kind separation, expiry/revocation, published-assignment visibility, tenant isolation, snapshot validation, one-winner sends, same-key failed/uncertain retries, crashed-caller lease recovery, resend confirmation and throttling. Typecheck/lint/format and ordinary production builds passed earlier; final build/HTTP results follow below. One HTTP fixture initially expected a published ceremony that an earlier test had intentionally moved to draft; corrected the fixture to publish before checking guest visibility.

Applied required invitation indexes to the configured development database through npm run db:indexes without changing application records. Checked the saved .env.local using presence/validity flags only: it still has database/auth settings only, no RESEND_API_KEY, valid EMAIL_FROM or invitation enable flag, and uses a local APP_ORIGIN. Live Resend credentials, domain verification and actual inbox delivery therefore remain unverified and disabled. The implementation does not provision a sender or deploy a public app URL.

Remaining review: desktop/mobile UI interaction and the target Node.js 24 runtime (host is 22.11.0). Browser visual review was not performed for this milestone; the prior isolated-server browser connectivity limitation remains. No real family/invitation fixtures, outbound emails, commits, pushes or deployment. Next: complete private email configuration and public URL setup, user UI review and a separately authorized single-recipient delivery test; then plan event-wise RSVP.

Final invitation verification: format:check, lint, typecheck and production build passed. All 63 tests passed: 16 invitation/provider-fixture cases, 14 family cases, 14 ceremony cases, ten authentication cases, eight wedding cases and the expanded built-app HTTP regression. HTTP checks cover the management/guest pages, fragment-link generation and exchange, restricted cookies/DTOs, disabled live sending, replacement revocation and family deletion. The final build hit the existing Windows/OneDrive EPERM error creating generated invite segment directories inside the sandbox; the identical build passed outside the sandbox without changing source/compiler settings. Earlier ordinary builds also passed. The final saved-environment check still reported no email key/sender/enable flag and no public HTTPS origin; real provider authentication/domain/inbox verification remains pending. No real recipient message or deployment was performed.

Configuration follow-up (28 October 2026): the saved environment now contains an API key and a syntactically valid plain sender mailbox. Invitation sending remains disabled and APP_ORIGIN remains local, so live delivery is still blocked by configuration. A read-only Resend domain request returned HTTP 401 with restricted_api_key; this does not establish an invalid sending key and did not verify the sender domain. No secrets were printed, configuration values changed, or emails sent. A real public HTTPS app URL and verified sender remain prerequisites before enabling delivery. No application code changed during this diagnosis.

## Deployed sign-in diagnosis (29 October 2026)

Implemented safe server-only stage logging; verification pending. User-provided Vercel logs confirm configuration:false for sign-in 503 failures, but do not identify the dependency. See [implementation plan](implementation-plan.md#deployed-sign-in-diagnosis-29-october-2026). The deployed failure is not yet resolved. No secrets, database records/indexes, environment values or deployment were changed. Next: deploy the diagnostic change, identify the failing stage in Runtime Logs and apply the corresponding verified fix.

Verification: formatting, lint, typecheck and production build passed. Seven authentication unit tests (including safe stage logging and unchanged public errors) passed, and all ten disposable-database authentication regressions passed outside the sandbox after loopback EACCES blocked the first run. No live database or account was used. The deployed error remains unresolved pending deployment and a stage-bearing log.

## Simple invitation send and guest acceptance (29 October 2026)

Implemented; automated verification passed; user UI review pending. Added an email-and-Send primary form that coordinates existing link generation, immutable preparation and individual sending, with advanced controls collapsed. Added explicit guest Accept invitation, persisted family acknowledgement/timestamp, and Accepted/Awaiting acceptance displays for the couple. Opening an invitation alone never accepts; repeated acceptance is idempotent and does not change ceremony attendance. See [implementation plan](implementation-plan.md#simple-invitation-send-and-guest-acceptance-29-october-2026) for semantics and deferred scope. No live email, database records/indexes, production settings or deployment changed. Production sign-in and live email delivery remain unverified and are not claimed fixed by this feature work.

Verification completed: format:check, lint, typecheck and ordinary production builds passed. All 34 relevant tests passed: 19 invitation/provider-fixture cases, 14 family regressions and one expanded built-app HTTP test. New checks cover explicit acceptance, opening without acceptance, concurrent idempotent clicks, cookie/tenant separation, rejected supplied identities, expiry, replacement/deletion revocation, persistence through rotation, unchanged event attendance, couple-visible timestamp and family-directory rendering. Tests used disposable MongoDB data and a local provider fixture; the built HTTP server explicitly disabled email sending. No actual inbox delivery, desktop/mobile browser interaction or target Node.js 24 runtime verification was performed. Current host remains Node.js 22.11.0. The feature remains local and uncommitted; production email setup/sign-in diagnosis and user review remain pending.

Pre-commit review (29 October 2026): fixed locale/timezone-dependent acceptance timestamps in the family directory and invitation manager by consistently formatting in en-IN and Asia/Kolkata, avoiding server/browser hydration differences. No further actionable issues found. Repeated formatting, lint, typecheck, production build and all 34 relevant tests passed. The sandboxed build hit generated-directory EPERM; the unchanged build command passed outside the sandbox. The user authorized committing and pushing this milestone. Production email setup/sign-in diagnosis, UI interaction and Node.js 24 verification remain pending.

## Ceremony-wise RSVP and attendance (29 October 2026)

Implemented; verification in progress. Retrieved approved Stitch guest desktop/mobile and attendance desktop designs. Added guest ceremony response forms with validated member counts, independent save/edit/retry, explicit latest-response recovery and anytime changes. Added a couple-only Attendance view with ceremony selector, canonical totals, literal search, status filters, pagination, refresh and responsive rows; family details show responses and separate acceptance. Existing private session/token and tenant boundaries remain enforced; no new collection/index or dependency. See [implementation plan](implementation-plan.md#ceremony-wise-rsvp-and-attendance-29-october-2026) for contracts, concurrency and prototype adaptations. No live records, outbound emails, secrets, commits, pushes or deployment changed. Initial 13 isolated RSVP tests, lint and typecheck passed; final checks and browser review remain pending.

Final verification: format:check, lint, typecheck, production build and all 61 relevant tests passed (13 RSVP, 19 invitation/provider-fixture, 14 family, 14 ceremony and one expanded built-app HTTP test). The HTTP check covers guest save/update, private attendance API/page, family-detail rendering, summary changes and revoked-session rejection. Tests used disposable MongoDB data and email fixtures with live sending disabled. The first sandboxed build hit the known Windows/OneDrive generated-directory EPERM issue; an unchanged build outside the sandbox then caught a duplicate variable in the expanded HTTP test. Renamed it, reran typecheck/lint/build and the built HTTP test successfully. No source/compiler workaround was introduced.

Browser verification completed against a temporary isolated production fixture: reviewed desktop and narrow-screen guest/attendance layouts, verified unanswered radios are unselected, rejected an over-limit count, saved a valid response, edited it to Not attending with the count input hidden, and confirmed the couple summary changed to zero guests/one not-attending family after refresh. Saved review screenshots under ignored .cache; closed review tabs and stopped the fixture server. Earlier browser loopback limitations did not recur. No live records or emails were used. Target Node.js 24 runtime and production/user review remain pending (host runs Node.js 22.11.0). No new dependencies, infrastructure, index changes, commits, pushes or deployment. Next: user review and separately authorized release of this bounded RSVP milestone before further features.

## Wedding dashboard and shared workspace (29 October 2026)

Implemented; user review pending. Added the cinematic /workspace dashboard using the approved desktop/mobile Stitch HTML and existing local imagery. Live source totals cover families, invited limits, unique families with pending published responses, separate household acceptance, up to six upcoming published ceremonies and per-ceremony attendance. GET /api/dashboard uses a tenant-owned transactional snapshot and safe DTO; no stored counters or cross-ceremony guest sums. Empty/loading/unavailable states and manual refresh are explicit. Existing couple pages now share sidebar/mobile navigation, account/sign-out, spacing and footer. Adjusted responsive layouts for sidebar width. No task/expense functionality or unsupported prototype controls were added. See [implementation plan](implementation-plan.md#wedding-dashboard-and-shared-workspace-29-october-2026) for scope and contracts.

Verification: seven isolated dashboard tests passed (IST boundaries, source updates/deletions/unpublishing, unique pending counts, separate acceptance, future-event order/limit, empty/incomplete setup, tenant/orphan exclusion and safe API failure). All 60 RSVP/invitation/family/ceremony regression tests and the expanded built-app HTTP test passed: 68 tests in total, with disposable MongoDB data and live email disabled. Updated HTTP expectations for streamed redirects introduced by the dashboard loading boundary; unauthenticated users still go to login and incomplete setup to wedding details. Formatting, lint, typecheck and production build results are recorded after final checks below.

Browser review used an isolated production fixture and confirmed the dashboard, real sample totals (3 families, 13 invited members, 1 accepted), quick-action dialog and shared ceremony/family navigation. Review found and corrected the family-table breakpoint for the narrower sidebar content area. Screenshot proof is stored under ignored .cache. Stitch screenshot retrieval was unavailable; both approved HTML designs were inspected. Target Node.js 24, a true mobile viewport and production/user review remain pending; the host runs Node.js 22.11.0. No live records, outbound emails, secrets, new dependencies, infrastructure, commits, pushes or deployment were changed. Next: user review of this milestone before release or another feature.

Final dashboard checks: npm run format:check, npm run lint, npm run typecheck and npm run build all passed on 29 October 2026. The final production build passed in the normal sandbox. Runtime target Node.js 24 verification remains pending.

## Selected Stitch dashboard visual revision (29 October 2026)

Implemented following the user's explicit selection of screen 4f67e6b351a44db79c8ce9aea2ac6d8b and instruction to build. Replaced the large photograph hero with the selected compact ivory/bronze registry banner and countdown; added a sidebar wedding summary, four live metric cards, two-column ceremony/acceptance/RSVP panels, published ceremony thumbnails and a labelled inspiration archive using existing local images. Shared shell colours, active navigation and borders align with this screen. Deferred Tasks/Expenses/Photos, concierge, notification, map and delivery claims remain excluded as agreed. No dependencies, environment settings, persistence contracts or live records changed. See the implementation plan for prototype adaptations. User review remains pending.

Verification: lint, typecheck, production build and the built-app HTTP regression passed. The HTTP fixture checks login/setup/dashboard and guest response/couple-summary flows with disposable data and email disabled. Final formatting and browser review results follow below. Node.js 24, true mobile viewport and production verification remain pending; checks ran on the available Node.js 22.11.0 host. No commit, push or deployment.

## Sidebar categories update (29 October 2026)

Implemented the user's exact eight sidebar categories: Dashboard, Events, Tasks, Expenses, Guests, Invitation, Photos and Settings. Existing ceremonies map to Events; families and attendance map to Guests, with an in-page attendance link. Invitation opens the existing directory in invitation mode, preserving search/pagination and linking to family invitation management. Wedding details maps to Settings. Tasks, Expenses and Photos appear as disabled Coming soon items with no fake pages or functionality. Private invitation detail routes highlight Invitation; attendance highlights Guests. Desktop and mobile share the same navigation definition. Automated verification is in progress; no production changes, commit or push.

Verification complete: format:check, lint, typecheck, production build and the expanded built-app HTTP regression passed. The regression confirms all eight labels appear, deferred items show Coming soon, and invitation-directory mode renders without an invalid-query error. The initial sandboxed commands failed with Node EPERM resolving the workspace parent; identical checks succeeded outside the sandbox. Browser visual review of these final sidebar labels remains pending. Existing source-data regression results remain recorded in the dashboard milestone above.

## Separate Guests and Invitation views (29 October 2026)

Implemented; verification in progress. Guests now shows family contact/member details, assigned ceremonies and published per-ceremony attendance responses/counts, with edit/delete and attendance filtering access. Invitation has a distinct sending-and-acceptance directory with literal search, email-status and acceptance filters, pagination, refresh, safe latest-attempt status/timestamps and links to the existing preview/link/send/retry manager. Acceptance remains separate from provider submission and RSVP. Existing server-side ownership and send safeguards are preserved. No new dependencies/indexes, live records, outbound emails, environment changes, commit/push or deployment. See the implementation plan for status semantics and scope.

Initial checks: typecheck and lint passed; 21 invitation/provider-fixture tests passed, including new directory isolation, filter, acceptance, expired-lease and status-change cases. Final build, family/RSVP, built HTTP and visual verification follow below. Tests use disposable local data and a fixture transport.

Final verification: format:check, lint, typecheck and production build passed. All 49 relevant tests passed (21 invitation/provider-fixture including two new directory cases, 14 family, 13 RSVP and one expanded built-app HTTP regression). The HTTP test confirms the Guests and Invitation tables have different contents and acceptance is shown in Invitation. Browser visual review was attempted twice, including a tool reset, but failed before opening a tab because the browser tool could not initialize its local assets. Desktop/mobile visual review and Node.js 24/production verification remain pending. The disposable UI fixture was stopped; no live data or outbound emails were used.

## Tasks and responsibilities � version 1 (29 October 2026)

Implemented; verification in progress. Reviewed all four approved Stitch HTML designs and matched the dashboard palette. Added Tasks navigation, task CRUD APIs, fixed Groom/Bride/Family responsibility, notes, optional due date/ceremony, Pending/In progress/Completed status, derived IST overdue indication, list search/filters/pagination and global status cards. Accessible native add/edit/delete dialogs preserve failures and require explicit load-latest on conflicts. The dashboard shows source-derived counts and task attention links. Event deletion preserves/unlinks tasks transactionally. Creation uses record-lifetime idempotency. See the implementation plan for confirmed reference overrides, HTTP and persistence contracts.

Initial verification: 12 isolated task tests passed, covering validation, dates, tenant ownership, creation replay/concurrency, completion timestamps/reopening, filters and pagination, version conflicts, ceremony deletion/races, rollback, dashboard aggregation and API protections. A TypeScript literal-filter issue was found and corrected; final typecheck/lint/build/HTTP and visual review remain in progress. No new dependencies, live index installation, production records, outbound emails, environment changes, commits, pushes or deployment.

Final task verification: format:check, lint, standalone typecheck and production build passed. All 34 relevant tests passed: 12 task, 14 ceremony, seven dashboard and one expanded built-app HTTP regression. The HTTP check covers task creation, rendered task list, real dashboard counts, completion clearing overdue and versioned deletion, alongside existing invitation/RSVP flows. Fixtures use disposable MongoDB with email disabled. A final editor review fixed dashboard deep-link dialogs reopening after save and refined uncertain-create retry handling; lint/typecheck/build passed afterward. No extra dependency or lockfile change.

Browser interaction review remains pending: the browser tool could not initialize its local assets. The Stitch desktop screenshot response was blank; all four design HTML files were reviewed. Node.js 24 and production verification remain pending (host is 22.11.0). Task creation against an existing database requires the operator to install the new indexes with npm run db:indexes after confirming the target environment; no live indexes or data were modified. No commit, push or deployment. Next: user review of this bounded Tasks milestone before release or another feature.

### Task setup repair (29 October 2026)

The user reported the generic task-unavailable error. Read-only checks confirmed the configured database is restricted to the mmm_dev/mmm_test naming boundary and connects successfully, but had no tasks collection. Ran the existing npm run db:indexes development operator successfully; it ensured application indexes without dropping data/indexes. Follow-up validation confirmed the tasks collection exists and the required unique creation index passes its runtime check. No credentials or individual records were printed, no task was created, and no production deployment/configuration, commit or push was performed. This is development database setup, distinct from the implementation-only tests recorded above.

Post-repair verification: formatting, lint, standalone typecheck and production build all passed. No application source changes were needed; the missing development database setup was repaired.

## Expenses and spending � version 1 (29 October 2026)

Implemented; final verification in progress. Reviewed four approved Stitch designs (all HTML plus desktop screenshot); reused the established dashboard colours and shared shell. Added actual-payment expense CRUD, exact rupee/paise conversion, fixed Groom/Bride/Family payers, optional ceremony association, past-or-today IST paid date, safe creation replay, versioned edits/deletes, global total/payer cards, search/payer/ceremony/date filters, pagination, ceremony breakdown and real dashboard spending/recent entries. Deleted ceremonies retain spending as Wedding-wide. No budgets, balances, receipt/vendor fields, exports or money movement. See the implementation plan for contracts and prototype adaptations.

Initial checks: all 14 isolated expense tests passed, including money boundaries, IST date limits, tenant isolation, retries/concurrent creation, filters, edit conflicts, ceremony deletion/race/rollback, overflow rejection, dashboard totals, HTTP security and missing-index errors. Typecheck and lint passed after correcting target-compatible BigInt syntax and payer-key types. Final build, regressions, development index setup and visual review follow below. No new dependency, secrets, actual payment records, production changes, commits, pushes or deployment.

Final expense verification: format:check, lint, standalone typecheck and production build passed. All 48 relevant tests passed: 14 expense, 14 ceremony, 12 task, seven dashboard and one expanded built-app HTTP regression. HTTP coverage includes exact displayed paise, creation replay/header, expense list, payer summary, dashboard spending, editing and deletion alongside the existing private feature flow. Tests use disposable MongoDB; no real payment records or emails were created.

Ran npm run db:indexes successfully through the existing mmm_dev/mmm_test-only operator command and independently verified the expense collection and unique retry-key index. This changes development indexes only, without dropping data/indexes or adding expense records. Removed the temporary verification helper afterward. Browser review remains pending: the browser tool failed while initializing local assets. Desktop/mobile interaction review, target Node.js 24 (host is 22.11.0) and production index/release verification remain pending. No new dependencies, secrets, production configuration, commits, pushes or deployment. Next: user review of this bounded actual-spending milestone before further feature work.

## Cloudinary preparation — 30 October 2026

Provider authentication verified; Photos implementation pending. Opened the existing Cloudinary Image environment, saved its existing credentials to ignored .env.local without replacing other settings, and passed a read-only authenticated ping. Added empty server-only environment examples and recorded the provider change and confirmed gallery rules in implementation-plan.md. No API secret was printed. No new credentials, unsigned presets, public media, uploads, dependencies, production settings or deployment were created. Private viewing/expiry, upload controls, environment isolation and gallery functionality remain unverified and unimplemented. See implementation-plan.md for scope and remaining decisions.

Cloudinary setup verification: format:check, lint and typecheck passed. Production build passed on retry outside the sandbox after the first build hit the existing Windows/OneDrive EPERM while creating a generated invite segment directory. Provider authentication ping passed without uploading media. Git confirms .env.local is ignored. No Photos application code or production configuration was added.

## Photos v1 — 30 October 2026

Implementation and verification in progress. Retrieved the approved Stitch desktop/mobile/guest gallery designs and enabled Photos in the shared navigation. Implemented couple and guest gallery/upload/viewer flows, couple-only deletion, versioned guest-access control, authenticated Cloudinary storage with fixed previews, app-authorized image streaming, tenant-safe metadata, retry-safe upload completion, quotas and explicit abandoned-upload cleanup. Updated public homepage memory copy to remove the superseded OneDrive description. See implementation-plan.md for architecture, security, operational limits and deferred scope.

Twenty isolated Photos tests and 63 related dashboard/family/invitation/RSVP/wedding regressions passed, plus one built-app HTTP test covering couple/guest Photos pages and access control (84 total at this checkpoint). The production build passed. Real provider probes with disposable generated PNGs verified signed upload and protected original/thumbnail access, then deleted the probes. Existing development database indexes were extended without inserting photo records into existing weddings. Browser review caught an empty-body completion issue; corrected it and added HTTP regression coverage. Final checks and repeated browser upload/viewer/mobile review follow below; do not treat this checkpoint as final visual approval. No production configuration, commit, push or deployment.

Final Photos verification: format:check, lint, standalone typecheck and production build passed after correcting the browser empty-stream completion check. All 84 relevant automated tests passed: 20 Photos, 63 dashboard/family/invitation/RSVP/wedding regressions and one expanded built-app HTTP regression. Repeated the 20 Photos tests and HTTP regression after that correction successfully. A final UI refinement adds an individual Retry action alongside batch retry; final checks are repeated below.

Browser review completed with an isolated MongoDB test wedding and generated non-personal PNG: real browser selection/direct upload/validation succeeded and displayed Added to gallery; authenticated thumbnail and enlarged image loaded; deletion confirmation/cancel worked; guest invitation opened the shared gallery with no deletion controls; pausing guest access hid its photos/upload controls on refresh while couple access remained available. Reviewed desktop and explicit 390px mobile couple layouts. Saved ignored .cache/photos-desktop.png as a preview containing generated test imagery only. Closed review tabs, restored viewport and stopped the fixture. Independently queried Cloudinary afterward and confirmed zero remaining disposable visual assets. Two standalone disposable provider probes were also deleted. Existing development wedding records and the user's port-3000 development server were preserved. Broader device testing, target Node.js 24 and production credentials/index/cleanup/release verification remain pending. No commit, push or deployment.

Final refinement checks: individual and batch Retry controls are implemented. The final format:check, lint and standalone typecheck passed; production build verification completed successfully after this refinement. No further feature development was started. Next milestone: user review of Photos locally, followed by separately authorized production Cloudinary configuration, indexes, cleanup operations and release validation.
