# RBAC permission ↔ route matrix (Phase 5 complete)

Machine-readable source: `app/application/admin/permission_matrix.py`  
Seeded permissions: `app/application/admin/rbac_service.py` (`PERMISSIONS`)

Enforcement helper: `require_permission(key)` in `app/api/v1/auth/deps.py`

## Status legend

| Status | Meaning |
|--------|---------|
| `enforced` | Route exists and uses the correct permission |
| `mismatch` | Route exists but wrong permission / wrong gate |
| `partial` | Some coverage; incomplete API surface |
| `planned` | Seeded permission with no enforcing API yet |

## Matrix

| Permission | Status | Routes | Notes |
|------------|--------|--------|-------|
| `security_reviews.read` | enforced | `GET /admin/security-reviews` | |
| `security_reviews.resolve` | enforced | `POST /admin/security-reviews/{id}/resolve` | |
| `users.read` | enforced | `GET /admin/users`, `GET /admin/users/{id}` | |
| `users.suspend` | enforced | `POST /admin/users/{id}/suspend`, `…/unsuspend` | Maker-checker |
| `admin_actions.approve` | enforced | `GET/POST /admin/actions…` | |
| `security.manage` | enforced | `GET /admin/security/config`, `POST …/config/update` | Maker-checker apply |
| `rbac.manage` | enforced | `GET /admin/rbac/roles`, role assign/revoke | |
| `encryption.rotate` | enforced | `POST /admin/encryption/rotate-mfa-keys` | |
| `transactions.execute` | enforced | `POST /admin/transactions/transfer` | Ops stub |
| `audit.read` | enforced | `GET /admin/audit` | |
| `retention.read` | enforced | `GET /admin/retention/schedule` | |
| `deletion.execute` | enforced | `GET/POST /admin/deletions…` | |
| `mf.jobs.read` | enforced | `GET /admin/mf/jobs`, `GET /admin/mf/ingestion-runs`, `GET /admin/mf/metrics`, `GET /admin/mf/pipeline/preview`, `GET /admin/mf/pipeline/runs/{run_id}`, `GET /admin/mf/pipeline/runs/active` | |
| `mf.jobs.run` | enforced | `POST /admin/mf/jobs/{job_name}/run` | Single job trigger |
| `mf.pipeline.run` | enforced | `POST /admin/mf/pipeline/run`, `POST /admin/mf/pipeline/runs/{run_id}/cancel`, `POST /admin/mf/pipeline/runs/{run_id}/resume`, `POST /admin/mf/pipeline/runs/{run_id}/retry-step`, `POST /admin/mf/pipeline/runs/{run_id}/approve-staging`, `POST /admin/mf/pipeline/clear-stuck` | Full bootstrap pipeline |
| `mf.amcs.read` | enforced | `GET /admin/mf/amcs` | |
| `mf.amcs.manage` | enforced | `PATCH /admin/mf/amcs/{id}` | |
| `mf.catalog.read` | enforced | `GET /admin/mf/overview`, `GET /admin/mf/catalog/health`, `GET /admin/mf/catalog/health/issues`, `GET /admin/mf/categories`, `GET /admin/mf/funds`, `GET /admin/mf/funds/{id}`, `GET /admin/mf/funds/{id}/navs` | |
| `mf.catalog.manage` | enforced | `PATCH /admin/mf/funds/{id}` | Audited catalog overrides |
| `mf.content.manage` | enforced | `PATCH /admin/mf/funds/{id}/content`, `PATCH /admin/mf/amcs/{id}/content`, `PATCH /admin/mf/compliance` | Display copy and compliance settings |
| `mf.rules.manage` | enforced | `POST/PATCH /admin/mf/rules`, `POST /admin/mf/rules/preview` | Catalog automation rules |
| `mf.catalog.publish` | enforced | `POST /admin/mf/rules/apply`, `POST /admin/mf/funds/bulk` | Apply rules and bulk catalog mutations |
| `mf.transactions.read` | enforced | `GET /admin/mf/transactions/overview`, `GET /admin/mf/transactions/orders`, `GET /admin/mf/transactions/orders/{order_id}`, `GET /admin/mf/transactions/checkouts/{checkout_id}`, `GET /admin/mf/transactions/sip-plans/{plan_id}`, `GET /admin/mf/transactions/mandates/{mandate_id}`, `GET /admin/mf/transactions/webhooks` | MF payment ops read |
| `mf.transactions.manage` | enforced | `POST /admin/mf/transactions/orders/{order_id}/sync`, `POST /admin/mf/transactions/sip-plans/{plan_id}/sync`, `POST /admin/mf/transactions/mandates/{mandate_id}/sync`, `POST /admin/mf/transactions/webhooks/{event_id}/replay`, `POST /admin/mf/transactions/expire-stale` | Reconcile, replay, expire |
| `mf.integrations.read` | enforced | `GET /admin/mf/integrations` | View MF provider integration status |
| `mf.integrations.manage` | enforced | `PATCH /admin/mf/integrations/{provider}/environment` | Switch provider test/live mode |
| `goals.templates.read` | enforced | `GET /admin/goals/templates`, `GET /admin/goals/templates/{template_id}` | Predefined goal templates |
| `goals.templates.manage` | enforced | `PATCH /admin/goals/templates/{template_id}` | Update goal template metadata |
| `recommendations.read` | enforced | `GET /admin/recommendations/config`, `GET /admin/recommendations/baskets`, `GET /admin/recommendations/baskets/{basket_id}`, `GET /admin/recommendations/preview`, `GET /admin/recommendations/publish-readiness`, `GET /admin/recommendations/metrics`, `GET /admin/recommendations/audit` | Recommendation baskets read, preview, readiness, metrics, audit |
| `recommendations.manage` | enforced | `POST/PATCH/DELETE /admin/recommendations/baskets…`, `PUT/POST/DELETE /admin/recommendations/baskets/{id}/funds…` | Maintain recommendation baskets |
| `recommendations.publish` | enforced | `POST /admin/recommendations/publish` | Publish recommendation config version |
| `distributor.clients.list` | enforced | `GET /distributor/clients` | Distributor console investor list with masked PII |
| `distributor.clients.read` | enforced | `GET /distributor/clients/{client_reference}` | Distributor console masked client profile aggregate |
| `admin.distributor_partners.list` | enforced | `GET /admin/distributor-partners/pending`, `GET /admin/distributor-partners/{partner_id}` | HO review queue for Zynd Mitra onboarding |
| `admin.distributor_partners.approve` | enforced | `POST /admin/distributor-partners/{partner_id}/approve`, `POST /admin/distributor-partners/{partner_id}/reject` | Approve or reject Zynd Mitra applications |
| `admin.distributor_hierarchy.read` | enforced | `GET /admin/distributor-hierarchy/overview`, `GET /admin/distributor-hierarchy/branches`, `GET /admin/distributor-hierarchy/managers`, `GET /admin/distributor-hierarchy/partners`, `GET /admin/distributor-hierarchy/state-heads`, `GET /admin/distributor-hierarchy/unassigned-states` | Mitra hierarchy read APIs for admin console |
| `admin.distributor_branches.list` | enforced | `GET /admin/distributor-hierarchy/branches` | Branch listing scope in hierarchy console |
| `admin.distributor_branches.manage` | enforced | `POST /admin/distributor-hierarchy/branches`, `POST /admin/distributor-hierarchy/branches/{branch_id}/assign-manager`, `POST /admin/distributor-hierarchy/state-heads`, `POST /admin/distributor-hierarchy/state-heads/{user_id}/pause`, `POST /admin/distributor-hierarchy/state-heads/{user_id}/resume`, `POST /admin/distributor-hierarchy/state-heads/{user_id}/replace`, `DELETE /admin/distributor-hierarchy/state-heads/{user_id}` | Submit branch opening requests, assign managers, and pause / change / remove Mitra State Heads |
| `admin.distributor_branches.approve` | enforced | `POST /admin/distributor-hierarchy/branches/{branch_id}/approve`, `POST /admin/distributor-hierarchy/branches/{branch_id}/reject` | Approve or reject branch opening requests |
| `admin.distributor_managers.list` | enforced | `GET /admin/distributor-hierarchy/managers` | Branch manager listing scope in hierarchy console |

## Seeded admin roles

| Role key | Display name | Permissions |
|----------|--------------|-------------|
| `super_admin` | Super Admin | All seeded permissions |
| `mitra_super_head` | Mitra Super Head | Full hierarchy read, branch manage, HO partner review |
| `mitra_state_head` | Mitra State Head | State-scoped hierarchy read, branch/manager provisioning in assigned state, and HO partner review |
| `mitra_manager` | Mitra Manager | Distributor console client + partner management |
| `mitra` | Mitra | Distributor console masked client profiles |

Legacy role keys `distributor_console` and `distributor_manager` are migrated to `mitra` and `mitra_manager` during RBAC seed. Removed built-in roles (`compliance_officer`, `support_agent`, `operations`, `catalog_publisher`) are deleted on seed; affected users fall back to `super_admin` when they would otherwise have no team role.

## Non-RBAC admin routes

| Route | Gate |
|-------|------|
| `GET /admin/rbac/me` | `require_admin_user` (any admin) |

## User vs admin transfers

| Route | Gate |
|-------|------|
| `POST /transactions/transfer` | `require_fund_eligible_user` (customer self-service) |
| `POST /admin/transactions/transfer` | `transactions.execute` |

## Guardrail tests

- `tests/test_phase0_inventory.py` — matrix covers all seeded permissions; no open gaps
- `tests/test_phase5_rbac.py` — permission scope and maker-checker behavior
