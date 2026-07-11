# Phase 4 — OTP platformization

Completed checklist.

## Done

| Item | Artifact |
|------|----------|
| Purpose registry + channel map | `app/application/identity/otp_purposes.py` |
| Unified application API | `app/application/identity/otp_app_service.py` (`request_otp`, `verify_otp`, `resend_otp`) |
| OTP port updated | `app/application/ports/otp_gateway.py` |
| Event-driven delivery | `auth.otp.requested` via `otp_events.py` + `otp_delivery_handler.py` |
| SMS adapter (stub) | `app/infrastructure/notifications/sms_service.py` |
| Redis peek for delivery | `peek_otp_code` in `infrastructure/otp/service.py` (code never in event payload) |
| Callers migrated | `signup_service`, `account_service` |
| Phase 4 tests | `tests/test_phase4_otp.py` |

## API

```python
from app.application.ports.otp_gateway import OtpPurpose, request_otp, verify_otp

meta = await request_otp(OtpPurpose.signup_email, email, ip=ip)
ok = await verify_otp(OtpPurpose.signup_email, email, code)
```

Legacy storage keys (`"email"`, `"mobile"`, etc.) still resolve for backward compatibility.

## Purposes

| Purpose | Channel | Used by |
|---------|---------|---------|
| `signup_email` | email | Signup |
| `signup_mobile` | sms | Signup |
| `email_change` | email | Account settings |
| `oauth_link` | email | OAuth link confirm |

## Delivery flow

1. `request_otp` stores code in Redis + schedules `auth.otp.requested` (no code in payload).
2. Outbox → relay → worker consumes event.
3. Handler peeks code from Redis and sends email/SMS.

## Config

- `SMS_PROVIDER=` (empty = dev log only) or `stub`
- `DEV_OTP` still works for local verification without delivery

See `PHASE_5.md` for RBAC completion.
