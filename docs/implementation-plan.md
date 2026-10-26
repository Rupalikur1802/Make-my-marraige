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
