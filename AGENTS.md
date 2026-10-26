# Repository guidance

- Implement only the user-authorized milestone. Preserve existing work; inspect Git status before editing. Do not commit, push, provision, or deploy without instructions.
- This is one root Next.js App Router TypeScript application, with npm and package-lock.json. Do not add a monorepo, Express backend, or speculative folders/layers.
- Follow confirmed user decisions, then docs/references: PRD for scope, system design for architecture, database design for persistence, API design for HTTP. Identify conflicts before implementing the affected behavior. Preserve reference files.
- Keep TypeScript strict and use @/* for src imports. Run npm run format:check, npm run lint, npm run typecheck, and npm run build after changes.
- Foundation must render/build without credentials or external connections. Never substitute fake authentication or in-memory persistence for real infrastructure.
- When integrations are authorized, keep database, email, cryptography and secrets server-only; use Node.js runtime and lazy configuration/connection checks. Never expose secrets through NEXT_PUBLIC_.
- Wedding is the tenant boundary. Derive ownership from the authenticated actor. Guest access is limited to the owning family and assigned published events. Return explicit safe DTOs.
- No public registration, application uploads/photo records, Graph, R2, vendor discovery, automated WhatsApp, queues, or bulk email. OneDrive access and cleanup remain external.
- Approved Stitch designs guide future UI. Preserve the restrained ivory/charcoal/olive direction; do not invent the full product interface.
- See docs/implementation-plan.md for completion boundaries and deferred decisions.
