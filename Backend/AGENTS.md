# Zynd Backend — agent notes

## Architecture docs

Start here before large refactors:

- `docs/architecture/PHASE_0.md`
- `docs/architecture/PHASE_1.md`
- `docs/architecture/PHASE_2.md`
- `docs/architecture/PHASE_4.md`
- `docs/architecture/PHASE_5.md`
- `docs/architecture/PHASE_6.md`
- `docs/architecture/RBAC_PERMISSION_MATRIX.md`
- `docs/architecture/ADR-001-event-publishing.md`
- `docs/architecture/SERVICE_BOUNDARIES.md`

## Hard rules (Phase 0+)

1. **Do not grow** `app/application/auth/service.py` with new features — split in Phase 1.
2. Keep RBAC matrix in sync: if you add a permission to `rbac_service.PERMISSIONS`, update `permission_matrix.py` and the markdown matrix in the same change.
3. Auth *decisions* (lockout, captcha, MFA gate, refresh reuse revoke) stay synchronous on the request path.
4. Side effects (emails, security reviews) go through the transactional outbox — see `PHASE_3.md`. Do not call SMTP from request handlers.
5. Prefer publishing domain events for emails / review queue / projections (see ADR-001). Do not invent a second ad-hoc bus.
6. OTP flows use `app/application/identity/otp_app_service.py` — do not call `infrastructure/otp/service.py` from application code.
7. Domain event payloads live in `app/domain/**/events.py` — use factories + `parse_event_payload` in workers; do not add ad-hoc dict shapes in publishers.
8. Postgres access for users/audit should go through repository adapters in `infrastructure/persistence/repositories/` when touching those aggregates.

## Lifespan seeds

`app/main.py` seeds RBAC, security config, retention schedule, and (development only) the admin user.
