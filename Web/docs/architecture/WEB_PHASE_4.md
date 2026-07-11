# Web Phase 4 — Dashboard & account feature modules

Completed checklist. Dashboard overview and account security/MFA live under `features/`.

## Done

| Item | Artifact |
|------|----------|
| Overview page module | `features/dashboard/overview/portfolio-overview-page.tsx` |
| Overview sections | `features/dashboard/overview/components/*` |
| Placeholder content config | `features/dashboard/config/dashboard-content.ts` |
| Security alerts storage | `features/account/security/login-security-alerts.ts` |
| Security alerts UI | `features/account/security/security-login-alerts.tsx` |
| MFA dialogs + verify UI | `features/account/mfa/components/*` |
| Fund eligibility banner | `features/account/mfa/components/fund-eligibility-banner.tsx` |
| MFA backup codes storage | `features/account/mfa/storage/mfa-backup-codes-storage.ts` |
| Backward-compat re-exports | `components/dashboard/mfa-*.tsx`, `lib/login-security-alerts.ts`, `lib/mfa-backup-codes-storage.ts` |

## Layout

```
src/features/
  dashboard/
    config/           # dashboard-content.ts — stat cards, placeholders
    overview/
      components/     # stat cards, portfolio, profile, activity
      portfolio-overview-page.tsx
    navigation/       # Phase 2
    components/       # section placeholder
  account/
    security/         # login alert storage + banner
    mfa/
      components/     # enroll, disable, reset, verify dialogs, banner
      storage/        # backup codes session storage
    api/              # Phase 1
```

## Import guidance

- **New dashboard overview content** → `features/dashboard/config/dashboard-content.ts`
- **Security login alerts** → `@/features/account/security`
- **MFA UI** → `@/features/account/mfa`
- **Legacy paths** (`@/components/dashboard/mfa-*`, `@/lib/mfa-backup-codes-storage`) still re-export from features

## Next: Web Phase 6

Quality — tests (Vitest), E2E (Playwright), error boundaries.
