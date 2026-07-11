<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Shared with Web

- Cross-app utilities live in `packages/zynd-shared` (`@zynd/shared`)
- See `docs/FRONTEND_SHARED_BOUNDARIES.md` at repo root
- Configure API client in `src/lib/api-client.ts`; do not duplicate input rules or fetch/session logic
