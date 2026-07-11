# Web Phase 6 — Quality & observability

Completed checklist. Unit tests, smoke E2E, and error boundaries lock in the Web refactor program.

## Done

| Item | Artifact |
|------|----------|
| Vitest | `vitest.config.ts`, `vitest.setup.ts` |
| Unit tests | `src/**/*.test.{ts,tsx}` — validation, routes, API errors, security alerts |
| Phase 0 guardrails test | `phase0-sanity.test.ts` |
| Playwright smoke E2E | `playwright.config.ts`, `e2e/smoke.spec.ts` |
| Client error boundary | `src/shared/components/zynd-error-boundary.tsx` |
| Dashboard route error UI | `src/app/dashboard/error.tsx` |
| Wrapped surfaces | Auth dialog steps + dashboard main content |

## Commands

```bash
cd Web && npm test              # Vitest unit/component tests
cd Web && npm run test:watch    # Vitest watch mode
cd Web && npm run test:e2e      # Playwright smoke (starts dev server)
```

E2E smoke covers marketing home, invalid reset-password link, and unauthenticated dashboard redirect. Playwright builds production (`next start` on port 7780) and mocks `/auth/refresh` + `/auth/me` so no backend is required.

## Test coverage focus

| Area | Tests |
|------|-------|
| Form validation | `auth-validation.test.ts` |
| Auth error helpers | `auth-errors.test.ts` |
| API error parsing | `api-client.test.ts` (`@zynd/shared`) |
| Dashboard routing | `dashboard-routes.test.ts` |
| Login security alerts | `login-security-alerts.test.ts` (session storage) |
| Config guardrails | `phase0-sanity.test.ts` |

## Error handling

- `ZyndErrorBoundary` — inline fallback for client subtrees (auth dialog, dashboard pages)
- `app/dashboard/error.tsx` — Next.js route-level recovery with reset button
- Copy lives in `copy.dashboard.error.*`

## Future (out of scope)

- Full signup/login/MFA E2E against live backend
- Zod schemas aligned with OpenAPI
- CI workflow wiring (add when repo CI is ready)

## Web refactor program — complete

Phases 0–6 delivered: config guardrails → auth split → routing → copy/variants → feature modules → shared package → tests & error boundaries.
