<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Support console

- Contact-team dashboard (tickets, users, audit logs)
- Auth via shared Backend (`clientKind: support` in `src/lib/api-client.ts`)
- Ticket APIs not wired yet — panels use empty states
- Cross-app utilities live in `packages/zynd-shared` (`@zynd/shared`)
- See `docs/FRONTEND_SHARED_BOUNDARIES.md` at repo root
