# Repository guidance

- Implement only the user-authorized milestone. Preserve existing work; inspect Git status before editing. Do not commit, push, provision, or deploy without instructions.
- This is one root Next.js App Router TypeScript application, with npm and package-lock.json. Do not add a monorepo, Express backend, or speculative folders/layers.
- Follow confirmed user decisions, then docs/references: PRD for scope, system design for architecture, database design for persistence, API design for HTTP. Identify conflicts before implementing the affected behavior. Preserve reference files.
- Keep TypeScript strict and use @/* for src imports. Run npm run format:check, npm run lint, npm run typecheck, and npm run build after changes.
- Foundation must render/build without credentials or external connections. Never substitute fake authentication or in-memory persistence for real infrastructure.
- When integrations are authorized, keep database, email, cryptography and secrets server-only; use Node.js runtime and lazy configuration/connection checks. Never expose secrets through NEXT_PUBLIC_.
- Wedding is the tenant boundary. Derive ownership from the authenticated actor. Guest access is limited to the owning family and assigned published events. Return explicit safe DTOs.
- Public couple signup is authorized (27 October 2026); see docs/implementation-plan.md. No application uploads/photo records, Graph, R2, vendor discovery, scheduled invitation delivery, queues, or bulk email. OneDrive access and cleanup remain external.
- Approved Stitch designs guide future UI. Preserve the restrained ivory/charcoal/olive direction; do not invent the full product interface.
- Invitation contact is optional family email. Secure links, restricted guest sessions, invitation preview and explicit individual email sends through Resend are authorized. Saving a family must never dispatch an email. Live delivery stays disabled until server configuration is ready; tests must use disposable data and a local provider fixture. Bulk sends, scheduled reminders and RSVP submission remain out of scope.
- See docs/implementation-plan.md for completion boundaries and deferred decisions.
- Maintain docs/project-status.md as the ongoing progress record. Whenever a major feature or milestone is implemented or materially updated, update this file in the same change with its status, delivered scope, verification results, and remaining work. Record only confirmed progress; distinguish implemented work from pending review or verification. Keep architecture, scope boundaries, and deferred decisions in docs/implementation-plan.md and link to them rather than duplicating them.
