# Service boundaries (Phase 0 guardrails)

## Frozen: `app/application/auth/service.py`

**Do not add new features to this module.** It is a temporary orchestration bag (~1100+ lines) scheduled for Phase 1 split.

Allowed in this file until Phase 1 lands:
- Bug fixes
- Security hotfixes
- Thin delegations to existing helpers

Not allowed:
- New signup/login/OAuth/account flows
- New side effects (email, audit variants, risk hooks)
- New Redis key schemes

### Target split (Phase 1)

| New module | Responsibility |
|------------|----------------|
| `signup_service.py` | Multi-step signup + email/mobile OTP orchestration |
| `login_service.py` | Email login + lockout/risk orchestration |
| `oauth_login_service.py` | Google/Apple login |
| `password_reset_service.py` | Forgot/reset password |
| `token_lifecycle_service.py` | Refresh/logout (+ merge `refresh_token_service`) |

## Keep separate

- `mfa_service.py`  TOTP/backup codes (not Redis OTP)
- `session_service.py`  session caps / revoke
- `progressive_lockout_service.py`  brute-force policy
- `risk_scoring_service.py`  adaptive scoring
- `account_service.py`  authenticated account mutations (will publish events later)

## OTP

`application/identity/otp_app_service.py`  unified request/verify API with purpose registry.  
`infrastructure/otp/service.py` owns Redis codes + cooldown only (internal).  
Delivery via `auth.otp.requested` worker  never put OTP codes in outbox/event payloads.

## Domain (Phase 6)

| Package | Responsibility |
|---------|----------------|
| `domain/shared/events.py` | `DomainEvent` envelope |
| `domain/shared/event_factory.py` | Build/parse typed payloads |
| `domain/auth/events.py` | Login + security review event payloads |
| `domain/account/events.py` | OTP + security email payloads |
| `domain/auth/repositories.py` | `UserRepository` protocol |
| `domain/shared/repositories.py` | `AuditRepository` protocol |
| `infrastructure/persistence/repositories/` | SQLAlchemy repository adapters |

Event type strings are defined in domain packages; `application/messaging/streams.py` re-exports them for workers.

## Domain folder map (API / application / Finprim core)

Public URL prefixes are unchanged; packages are aligned by domain.

| Domain | HTTP prefix | `app/api/v1/` | `app/application/` | Finprim HTTP (`app/infrastructure/core/`) |
|--------|-------------|---------------|--------------------|-------------------------------------------|
| Login / auth | `/auth` | `auth/` | `auth/`, `identity/` |  |
| KYC | `/kyc` | `kyc/` | `kyc/` | `core/kyc/` (POA, forms, Finprim KYC tenant) |
| Mutual funds | `/invest` | `mf/` (package name; not `/mf` URL) | `mf/` | `core/mf/` (OMS, investor, payment, mandate) |
| Portfolio / CAS / reports | `/invest/...` | `mf/portfolio_router.py` | `mf/` (holdings, reports, redemptions) | via OMS |
| Risk profile | `/invest/risk-profile/...` | `mf/risk_profile_router.py` | `risk_profile/` |  |
| Investor settings | `/kyc/settings/...` | `kyc/router.py` (today) | `investor/` (`investor_settings_service`) | via `core/mf/investor_client` when synced |
| Referrals | `/referrals` | `referral/` | `referral/` |  |
| Family | `/family-groups` | `family_groups/` | `family_groups/` |  |
| Goals | `/goals` | `goals/` | `goals/` |  |

Platform config, DB, and Redis remain in `app/core/` (not the Finprim orchestrator). See [CYBRILLA_HTTP_ORCHESTRATOR.md](./CYBRILLA_HTTP_ORCHESTRATOR.md) for orchestrator layout (`infrastructure/core/`).

### API layer

Routers import application services or `app.application.core.facade`  not `app.infrastructure.mf.fp_*` or raw `core` clients (CI guard).
