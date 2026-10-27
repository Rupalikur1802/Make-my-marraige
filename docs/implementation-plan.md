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
4. Families: assignments, approved invitation UI, RSVP and manual WhatsApp sharing. Test event visibility, count limits and assignment/deletion races.
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
