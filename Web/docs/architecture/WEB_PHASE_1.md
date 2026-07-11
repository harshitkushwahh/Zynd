# Web Phase 1 — Structural cleanup

Completed checklist. Same auth UX and API contracts; code split into feature modules.

## Done

| Item | Artifact |
|------|----------|
| Auth API types | `src/features/auth/api/types.ts` |
| Signup API | `src/features/auth/api/signup-api.ts` |
| Login / MFA verify / OAuth link | `src/features/auth/api/login-api.ts` |
| Session bootstrap | `src/features/auth/api/session-api.ts` |
| Password reset API | `src/features/auth/api/password-api.ts` |
| MFA API | `src/features/account/api/mfa-api.ts` |
| Account + sessions API | `src/features/account/api/account-api.ts` |
| OAuth connections API | `src/features/account/api/oauth-api.ts` |
| Backward-compat barrel | `src/lib/auth-api.ts` (re-exports) |
| Auth dialog flow hook | `src/features/auth/hooks/auth-dialog-flow.tsx` |
| Step components | `src/features/auth/components/steps/*` |
| Thin dialog shell | `src/components/auth/auth-dialog.tsx` (~45 lines) |
| Step copy + constants | `src/features/auth/constants/auth-steps.ts` |
| Auth error helpers | `src/features/auth/utils/auth-errors.ts` |

## Layout

```
src/features/
  auth/
    api/           # signup, login, session, password
    components/    # auth-dialog-steps + step forms
    constants/
    hooks/         # AuthDialogFlowProvider + useAuthDialogFlow
    utils/
  account/
    api/           # mfa, account settings, oauth, sessions
```

## Import guidance

- **New code:** import from `@/features/auth/api/*` or `@/features/account/api/*`
- **Existing imports:** `@/lib/auth-api` still works (deprecated barrel)

## Auth dialog

- State and handlers live in `auth-dialog-flow.tsx`
- Each step is a focused component under `components/steps/`
- Dialog remounts flow on close (`key` increment) for a clean reset

## Next: Web Phase 3

Copy constants, button variants, and remaining env/metadata cleanup.
