# Web Phase 5 — Shared package with Admin

Completed checklist. Web and Admin consume `@zynd/shared` instead of duplicating core client utilities.

## Done

| Item | Artifact |
|------|----------|
| Shared package | `packages/zynd-shared/` |
| npm workspaces | Root `package.json` |
| Input rules | `@zynd/shared/input-rules` |
| API client | `@zynd/shared/api` (+ `configureApiClient`) |
| Turnstile widget | `@zynd/shared/components/turnstile` |
| `cn()` helper | `@zynd/shared/utils` |
| Web thin wrappers | `lib/api-client.ts`, `lib/input-rules.ts`, `lib/utils.ts`, turnstile wrapper |
| Admin thin wrappers | Same pattern under `Admin/src/` |
| Boundary docs | `docs/FRONTEND_SHARED_BOUNDARIES.md` |

## App integration

Each app configures the shared API client once:

```ts
import { configureApiClient } from "@zynd/shared/api";
import { env } from "@/lib/env";

configureApiClient({ apiUrl: env.apiUrl });
export * from "@zynd/shared/api";
```

Turnstile wrappers inject `env.turnstileSiteKey` — keys stay app-local.

## Import guidance

- **Shared between Web + Admin** → add to `packages/zynd-shared`, re-export from app `lib/` if needed for `@/` paths
- **Web-only** → stay in `Web/src/features/` or `Web/src/shared/`
- **Admin-only** → stay in `Admin/src/`

## Next: Web Phase 6 — complete

See `WEB_PHASE_6.md`. Refactor program phases 0–6 are done.
