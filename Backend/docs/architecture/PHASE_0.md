# Phase 0 — Inventory & guardrails

Completed checklist for the backend refactor program.

## Done

| Item | Artifact |
|------|----------|
| Permission ↔ route matrix | `docs/architecture/RBAC_PERMISSION_MATRIX.md` + `app/application/admin/permission_matrix.py` |
| Matrix guardrail test | `tests/test_phase0_inventory.py` |
| Event publishing ADR | `docs/architecture/ADR-001-event-publishing.md` |
| Freeze `auth/service.py` growth | Module banner in `app/application/auth/service.py` + `docs/architecture/SERVICE_BOUNDARIES.md` |
| Retention seed on startup | `ensure_retention_seed` in `app/main.py` lifespan |
| Backend agent notes | `AGENTS.md` |

## Startup seeds (lifespan)

On API boot (`APP_ENV=development` for admin user only):

1. `ensure_dev_admin_seed` — `admin@zynd.com` (development only)
2. `ensure_rbac_seed` — permissions, roles, super_admin assignments
3. `ensure_security_config_seed` — lockout/risk defaults
4. `ensure_retention_seed` — data retention schedule rows

## Next: Phase 2

See `docs/architecture/PHASE_1.md` for completed Phase 1 work.

Event consumers, router import cleanup, outbox evaluation (ADR-001).
