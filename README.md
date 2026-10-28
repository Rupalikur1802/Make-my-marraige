# Make My Marriage

Beautiful celebrations. Thoughtfully planned.

Repository foundation for a single Next.js App Router application. The public homepage now follows the approved Stitch desktop design, with responsive layouts and labeled sample planning, invitation and RSVP previews. Couple login, persistent sessions, logout, and a protected welcome page are implemented. Wedding setup with saved drafts, a completed overview and six draft ceremonies is implemented. Ceremony editing, other planning features and external integrations remain deferred.

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

WhatsApp sharing is manual; directions use Maps links; livestreams use YouTube. Photos stay in OneDrive, with JPEG requested as text. Hide website photo access at midnight Asia/Kolkata on weddingDate plus seven calendar days. The couple manually revokes sharing/deletes files; hiding the button cannot revoke a copied link. No application upload or photo collection is planned.

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

Maps/OneDrive settings, ceremony editing/publication, invitations and full dashboard features remain deferred. Completing setup does not publish anything or contact guests.

Restart an existing development server after this model update so cached Mongoose models are reloaded before testing setup.
