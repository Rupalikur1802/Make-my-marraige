# Make My Marriage

Beautiful celebrations. Thoughtfully planned.

Repository foundation for a single Next.js App Router application. Currently only a static brand page exists. Authentication, persistence, business APIs, and integrations are not implemented.

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

No .env.local file or external credentials are required. .env.example documents future server-only configuration as commented entries. Nothing connects to MongoDB or Resend, including at build time. Fonts use local system fallbacks.

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

Formatting excludes the existing reference documents and generated files. No automated feature tests exist yet; the foundation uses static checks and development/production HTTP smoke checks.

## Structure and conventions

- src/app: root layout, static page, and global palette/typography.
- docs/references: existing Markdown product and technical specifications, preserved as supplied. The four same-named PDFs requested during planning were absent.
- docs/implementation-plan.md: completed scope, next milestones, and deferred decisions.
- AGENTS.md: concise repository guidance.

TypeScript uses strict mode, unchecked-index checks, and @/* mapped to src/*. Use plain CSS initially. Approved Stitch designs will guide the actual interface.

Future modules will own domain validation, services, persistence and explicit DTOs. Add them only with implemented features. Server Components should call services directly; route handlers adapt HTTP. Database/email/password code will be server-only and use the Node.js runtime. Validate service configuration only when needed, without global imports connecting to services. Development and preview credentials must never fall back to production.

Generated outputs, node_modules, local environment files, logs and reports are ignored. Commit source/configuration, next-env.d.ts and package-lock.json when a commit is explicitly authorized. Never commit credentials.

## Product boundaries

One provisioned shared couple account owns one wedding; no public registration. Wedding is the tenant boundary. Guests use secure family links without accounts and see only assigned published events. MongoDB Atlas/Mongoose, custom sessions and Resend password resets are future work.

WhatsApp sharing is manual; directions use Maps links; livestreams use YouTube. Photos stay in OneDrive, with JPEG requested as text. Hide website photo access at midnight Asia/Kolkata on weddingDate plus seven calendar days. The couple manually revokes sharing/deletes files; hiding the button cannot revoke a copied link. No application upload or photo collection is planned.

English, INR and Asia/Kolkata are the product defaults. No service has been provisioned or deployment performed.
