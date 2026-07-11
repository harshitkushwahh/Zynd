# Zynd Web — agent notes

## Architecture docs

- `docs/architecture/WEB_PHASE_0.md`
- `docs/architecture/WEB_PHASE_1.md`
- `docs/architecture/WEB_PHASE_2.md`
- `docs/architecture/WEB_PHASE_3.md`
- `docs/architecture/WEB_PHASE_4.md`
- `docs/architecture/WEB_PHASE_5.md`
- `docs/architecture/WEB_PHASE_6.md`
- `docs/FRONTEND_SHARED_BOUNDARIES.md` (repo root)

## Hard rules (Phase 0+)

1. New auth/signup/login API calls go in `src/features/auth/api/` or `src/features/account/api/` — not directly in components.
2. New auth dialog steps go under `src/features/auth/components/steps/` and register in `auth-dialog-steps.tsx`.
3. `@/lib/auth-api` is a compatibility barrel; prefer feature imports for new code.
4. Dashboard nav items live in `src/features/dashboard/navigation/dashboard-routes.ts` — add routes there and under `app/dashboard/`.
5. Browser storage keys live in `src/shared/config/storage-keys.ts`.
6. Timings and limits live in `src/shared/config/app-config.ts`.
7. User-facing brand and OTP copy live in `src/shared/config/copy.ts` / `brand.ts` — use `env.appName`, not literal `"ZYND"`.
8. Server-only env (`BACKEND_URL`) → `src/shared/config/server-env.ts`.
9. User initials / display name → `src/shared/utils/user-display.ts`.
10. Auth submit buttons → `size="auth"`; OAuth buttons → `variant="auth-oauth" size="auth"`.
11. User-facing copy → `src/shared/config/copy.ts` (not inline strings for OTP, MFA, deletion, marketing).
12. Dashboard nav chrome → `uiClasses` from `@/shared/config/ui-classes.ts`.
13. Dashboard placeholder/stub content → `features/dashboard/config/dashboard-content.ts`.
14. Security login alerts → `features/account/security/`; MFA UI → `features/account/mfa/`.
15. Cross-app client utilities → `packages/zynd-shared` (`@zynd/shared`); configure via app `lib/api-client.ts`.
16. Add/maintain unit tests alongside changed logic (`npm test` in `Web/`).
17. Dashboard/auth UI errors → `ZyndErrorBoundary` or route `error.tsx`; user copy in `copy.dashboard.error`.

## Shared config import

```ts
import { appConfig, copy, storageKeys, APP_NAME } from "@/shared/config";
```

## Dev & test

```bash
cd Web && npm run dev   # port 7777
cd Web && npm test
cd Web && npm run test:e2e
```

Copy `.env.example` to `.env.local` for local overrides.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
