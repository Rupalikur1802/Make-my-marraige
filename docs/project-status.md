# Project status

Last updated: 27 October 2026

This is the ongoing record of major features and milestones delivered in Make My Marriage. Update it whenever a major feature is built or materially changed, including its status, delivered scope, verification, and remaining work. Only mark confirmed work complete; record pending review and verification explicitly.

See [implementation plan](implementation-plan.md) for authorized milestone boundaries, future milestones, architecture decisions, and deferred questions. This progress record does not authorize additional implementation.

## Current overview

| Feature or milestone                       | Status                             | Remaining work                                            |
| ------------------------------------------ | ---------------------------------- | --------------------------------------------------------- |
| Project scaffold and repository foundation | Implemented                        | Verify on the target Node.js 24 runtime.                  |
| Public homepage and design refresh         | Implemented; user review completed | Explicit mobile viewport verification remains unrecorded. |
| Couple login, sessions, and logout         | Implemented; user review completed | Node.js 24 and Vercel packaging verification.             |
| Public couple signup                       | Implemented; user review completed | Email verification and password recovery are deferred.    |
| Login design refresh                       | Implemented; user review completed | Explicit mobile viewport verification remains unrecorded. |

Couple signup, authentication, supporting persistence, and signup/login/session/logout APIs are implemented. Development database connection and index setup are verified. The user confirmed completion of code review and page-flow checks on 27 October 2026. Planning features, guest authentication and external integrations remain deferred; future milestones require user authorization.

## Latest review checkpoint (27 October 2026)

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
