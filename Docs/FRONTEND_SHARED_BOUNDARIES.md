# Frontend shared package boundaries (Phase 5)

Cross-app TypeScript shared between **Web** and **Admin**. Backend boundaries remain in `Backend/docs/architecture/SERVICE_BOUNDARIES.md`.

## Package: `@zynd/shared`

Location: `packages/zynd-shared/`

| Module | Export | Used by |
|--------|--------|---------|
| Input validation rules | `@zynd/shared/input-rules` | Web signup/profile, Admin login |
| HTTP client + session refresh | `@zynd/shared/api` | Web auth/account APIs, Admin auth/admin APIs |
| Class name helper | `@zynd/shared/utils` | Both apps (via `@/lib/utils`) |
| Turnstile widget | `@zynd/shared/components/turnstile` | Both apps (via env-injecting wrapper) |

## Configuration pattern

Each app keeps its own `lib/env.ts` and calls `configureApiClient({ apiUrl: env.apiUrl })` once from `lib/api-client.ts`.

Turnstile site keys are **not** in the shared package — each app wraps `TurnstileWidget` and passes `env.turnstileSiteKey`.

## What stays app-local

| Area | Web | Admin |
|------|-----|-------|
| Auth flows / dialogs | `Web/src/features/auth/` | Admin login card |
| Dashboard UI | `Web/src/features/dashboard/` | Admin dashboard |
| API route modules | `Web/src/features/*/api/` | `Admin/src/lib/admin-api.ts` |
| Brand / copy | `Web/src/shared/config/` | Admin-specific copy |
| Next.js routes | `Web/src/app/` | `Admin/src/app/` |

## Do not duplicate into apps

- `INPUT_RULES` field definitions
- `ApiError` / `apiRequest` / refresh token logic
- `cn()` helper
- Turnstile DOM integration

Add new shared code to `@zynd/shared` when **both** frontends need it. App-only logic stays in Web or Admin.

## Monorepo

Root `package.json` defines npm workspaces: `Web`, `Admin`, `packages/*`.

Install from repo root:

```bash
npm install
```

Both apps declare `"@zynd/shared": "*"` and set `transpilePackages: ["@zynd/shared"]` in `next.config.ts`.
