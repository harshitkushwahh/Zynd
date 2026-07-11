# Phase 1 — Structural cleanup

Completed checklist. No API behavior changes — internal module boundaries only.

## Done

| Item | Artifact |
|------|----------|
| Split `auth/service.py` | `signup_service`, `login_service`, `oauth_login_service`, `token_lifecycle_service`, `user_service`, `auth_session_context` |
| Backward-compatible facade | `app/application/auth/service.py` re-exports public API |
| Centralized audit writes | `app/application/auth/audit_service.py`; used by `session_service`, `account_service`, `deletion_executor_service`, `oauth_service` |
| Extract signup draft store | `app/infrastructure/persistence/signup_draft_store.py` |
| Extract reset token store | `app/infrastructure/persistence/password_reset_token_store.py` |
| OTP module trimmed | `app/infrastructure/otp/service.py` — OTP only; re-exports draft/reset for compat |
| Unified OAuth | `app/application/auth/oauth_service.py` (state + connect/disconnect); thin re-exports in `oauth_state_service`, `oauth_settings_service` |
| Application ports | `app/application/ports/otp_gateway.py`, `email_gateway.py`, `messaging/event_publisher.py` |
| Shared datetime helper | `app/application/shared/datetime_utils.py` |
| Auth errors extracted | `app/application/auth/errors.py` |

## Import guidance

- **New code:** import from the specific module (e.g. `signup_service`, `oauth_service`), not `service.py`.
- **Routers:** import from specific auth modules (Phase 2 router cleanup done for `auth/router.py`).

## Next: Phase 3

See `docs/architecture/PHASE_2.md`.
