# Web Phase 3 — Copy, UI variants & metadata

Completed checklist. User-facing strings centralized; auth buttons use design-system variants.

## Done

| Item | Artifact |
|------|----------|
| Expanded copy | `src/shared/config/copy.ts` — meta, settings, MFA, reset password, marketing |
| Button variants | `size="auth"`, `variant="auth-oauth"` on `components/ui/button.tsx` |
| UI surface classes | `src/shared/config/ui-classes.ts` — dashboard nav chrome |
| Metadata from copy | `app/layout.tsx` → `copy.meta.siteDescription` |
| Auth flow buttons | Replaced `AUTH_PRIMARY_BUTTON_CLASS` with `size="auth"` |
| OAuth buttons | `variant="auth-oauth" size="auth"` |
| Settings / MFA / deletion | Migrated inline strings to `copy.*` |
| Landing + reset password | Marketing and reset flows use `copy` |
| Deletion grace days | Driven by `appConfig.deletionGracePeriodDays` in copy helpers |

## Button usage

```tsx
// Primary auth submit
<Button type="submit" size="auth">Continue</Button>

// OAuth provider
<Button type="button" variant="auth-oauth" size="auth">...</Button>
```

## Copy sections

| Key | Purpose |
|-----|---------|
| `copy.meta` | Site metadata |
| `copy.auth` | Auth dialog + OAuth |
| `copy.account` | Profile, deletion, devices |
| `copy.settings` | Settings nav titles/descriptions |
| `copy.mfa` | Enroll, reset, disable, regenerate dialogs |
| `copy.resetPassword` | Reset password page |
| `copy.marketing` | Landing page hero + feature cards |
| `copy.authSteps` | Auth dialog step headers |

## Import guidance

- User-facing strings → `copy` from `@/shared/config`
- Repeated nav chrome → `uiClasses.navSurface` etc.
- Do not reintroduce `AUTH_PRIMARY_BUTTON_CLASS` or inline `h-11 w-full shadow-zynd-mid` on auth submits

## Next: Web Phase 5

Optional shared package with Admin, or Phase 6 quality (tests, E2E).
