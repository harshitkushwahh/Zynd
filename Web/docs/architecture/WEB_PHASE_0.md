# Web Phase 0 — Inventory & guardrails

Completed checklist for the Web app refactor program.

## Done

| Item | Artifact |
|------|----------|
| Central app config | `src/shared/config/app-config.ts` |
| Storage keys | `src/shared/config/storage-keys.ts` |
| Brand + tagline | `src/shared/config/brand.ts` + `NEXT_PUBLIC_APP_*` in `lib/env.ts` |
| User-facing copy | `src/shared/config/copy.ts` |
| Server env (API proxy) | `src/shared/config/server-env.ts` |
| User display helpers | `src/shared/utils/user-display.ts` |
| Env template | `.env.example` |
| Auth dialog freeze | Banner on `components/auth/auth-dialog.tsx` |
| Agent notes | `Web/AGENTS.md` |

## Config modules

### `app-config.ts`

Runtime behavior constants (not marketing copy):

- Session retry interval, bootstrap retry/backoff
- OTP length, deletion grace days, max active devices
- Default country (from `input-rules`)

### `storage-keys.ts`

All browser `sessionStorage` / cooldown keys in one place.

### `copy.ts`

User-facing strings that reference app name or OTP length. Components should import from here instead of inline `"ZYND"` or `"6-digit"`.

### `brand.ts`

- `APP_NAME`, `APP_TAGLINE` from env
- `appTitle()`, `appBrandLockup()` for metadata and marketing

## Env vars

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_APP_NAME` | Client | Brand name (default `ZYND`) |
| `NEXT_PUBLIC_APP_TAGLINE` | Client | Tagline |
| `NEXT_PUBLIC_API_URL` | Client | API base (default `/api/v1`) |
| `BACKEND_URL` | Server | FastAPI proxy target |

See `.env.example`.

## File map (80 files)

```
src/
  app/                    # Routes (landing, dashboard, settings, reset-password, API proxy)
  components/
    auth/                 # Auth dialog (~1300 lines — frozen until Phase 1)
    dashboard/            # Shell, nav, settings panels, MFA dialogs
    ui/                   # Design system
  contexts/               # auth-context
  hooks/                  # use-otp-resend-cooldown
  lib/                    # api-client, auth-api, validation (legacy layout)
  shared/                 # Phase 0+ config & utils
    config/
    utils/
  styles/                 # zynd-brand.css
```

## Hard rules (Phase 0+)

1. **Do not grow** `components/auth/auth-dialog.tsx` with new flows — split in Web Phase 1.
2. New storage keys → add to `storage-keys.ts` only.
3. New timings/limits → add to `app-config.ts`.
4. User-facing brand/OTP copy → `copy.ts` or `brand.ts`.
5. `BACKEND_URL` only via `server-env.ts` (never hardcode in route handlers).

## Known gaps (Phase 1+)

- `auth-dialog.tsx` and `lib/auth-api.ts` still monolithic
- Dashboard tabs use client section state, not distinct routes
- Duplicate nav meta (`dashboard-nav`, `dashboard-page-meta`, `dashboard-top-nav`)
- No automated Web tests yet

## Next: Web Phase 1

Split `auth-dialog.tsx` and `lib/auth-api.ts` without behavior changes.

See `WEB_PHASE_1.md` for completed Web Phase 1 work.

## Next: Web Phase 2
