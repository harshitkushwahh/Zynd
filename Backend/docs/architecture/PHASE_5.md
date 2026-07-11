# Phase 5 — RBAC completion

Completed checklist.

## Done

| Item | Artifact |
|------|----------|
| User list + read permission fix | `GET /admin/users`, `GET /admin/users/{id}` → `users.read` |
| Audit query API | `GET /admin/audit` + `audit_admin_service.py` |
| Security config admin | `GET /admin/security/config`, maker-checker `POST /admin/security/config/update` |
| RBAC mutations | assign/revoke role routes under `rbac.manage` |
| Ops transfer gate | `POST /admin/transactions/transfer` → `transactions.execute` |
| Permission matrix | all entries `enforced` in `permission_matrix.py` |
| Phase 5 tests | `tests/test_phase5_rbac.py` |

## Admin APIs added

| Permission | Routes |
|------------|--------|
| `users.read` | `GET /admin/users`, `GET /admin/users/{user_id}` |
| `users.suspend` | `POST /admin/users/{user_id}/suspend`, `…/unsuspend` |
| `audit.read` | `GET /admin/audit` |
| `security.manage` | `GET /admin/security/config`, `POST /admin/security/config/update` |
| `rbac.manage` | `GET/POST/DELETE /admin/rbac/users/{user_id}/roles…` |
| `transactions.execute` | `POST /admin/transactions/transfer` |

## Maker-checker

`AdminActionType.security_config_update` is wired in `admin_action_service._execute_action` and applies via `apply_security_config_update` (with history row).

## User vs admin transfers

- **User self-service:** `POST /transactions/transfer` — still gated by `require_fund_eligible_user` (MFA + account status).
- **Ops/admin:** `POST /admin/transactions/transfer` — requires `transactions.execute` (super_admin only in seed roles).

## Guardrails

- `tests/test_phase0_inventory.py` — matrix must have no `planned` / `mismatch` / `partial` entries.
- `tests/test_phase5_rbac.py` — list/audit, RBAC assign/revoke, support_agent scope, security config approval.
