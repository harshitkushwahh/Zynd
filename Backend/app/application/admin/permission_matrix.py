"""RBAC permission ↔ route inventory (Phase 0 source of truth).

Every key in `PERMISSIONS` (rbac_service) must appear here.
Statuses:
  - enforced: route exists and uses require_permission(key)
  - mismatch: route exists but wrong permission / wrong gate
  - planned: seeded but no enforcing API yet
  - partial: some coverage, incomplete surface
"""

from __future__ import annotations

from typing import Literal, TypedDict

PermissionStatus = Literal["enforced", "mismatch", "planned", "partial"]


class PermissionRouteEntry(TypedDict):
    permission: str
    status: PermissionStatus
    routes: list[str]
    notes: str


PERMISSION_ROUTE_MATRIX: list[PermissionRouteEntry] = [
    {
        "permission": "security_reviews.read",
        "status": "enforced",
        "routes": ["GET /admin/security-reviews"],
        "notes": "Lists open/resolved security review items.",
    },
    {
        "permission": "security_reviews.resolve",
        "status": "enforced",
        "routes": ["POST /admin/security-reviews/{item_id}/resolve"],
        "notes": "Resolve or dismiss a review item.",
    },
    {
        "permission": "users.read",
        "status": "enforced",
        "routes": [
            "GET /admin/users",
            "GET /admin/users/{user_id}",
        ],
        "notes": "List and view user account summaries.",
    },
    {
        "permission": "users.suspend",
        "status": "enforced",
        "routes": [
            "POST /admin/users/{user_id}/suspend",
            "POST /admin/users/{user_id}/unsuspend",
        ],
        "notes": "Maker-checker account suspension and reactivation.",
    },
    {
        "permission": "admin_actions.approve",
        "status": "enforced",
        "routes": [
            "GET /admin/actions",
            "POST /admin/actions/{action_id}/approve",
            "POST /admin/actions/{action_id}/reject",
        ],
        "notes": "Maker-checker approval queue.",
    },
    {
        "permission": "security.manage",
        "status": "enforced",
        "routes": [
            "GET /admin/security/config",
            "POST /admin/security/config/update",
        ],
        "notes": "Read config; updates go through maker-checker security_config_update.",
    },
    {
        "permission": "rbac.manage",
        "status": "enforced",
        "routes": [
            "GET /admin/rbac/roles",
            "GET /admin/rbac/users/{user_id}/roles",
            "POST /admin/rbac/users/{user_id}/roles",
            "DELETE /admin/rbac/users/{user_id}/roles/{role_key}",
        ],
        "notes": "List roles and assign/revoke admin role assignments.",
    },
    {
        "permission": "encryption.rotate",
        "status": "enforced",
        "routes": ["POST /admin/encryption/rotate-mfa-keys"],
        "notes": "Creates maker-checker action for MFA key rotation.",
    },
    {
        "permission": "transactions.execute",
        "status": "enforced",
        "routes": ["POST /admin/transactions/transfer"],
        "notes": (
            "Ops-initiated transfers. User self-service POST /transactions/transfer "
            "remains fund-eligibility gated."
        ),
    },
    {
        "permission": "audit.read",
        "status": "enforced",
        "routes": ["GET /admin/audit"],
        "notes": "Paginated audit log query with optional user/event filters.",
    },
    {
        "permission": "retention.read",
        "status": "enforced",
        "routes": ["GET /admin/retention/schedule"],
        "notes": "Lists seeded retention policies.",
    },
    {
        "permission": "deletion.execute",
        "status": "enforced",
        "routes": [
            "GET /admin/deletions/pending",
            "POST /admin/deletions/run-executor",
        ],
        "notes": "Pending deletions + maker-checker executor run.",
    },
    {
        "permission": "documents.read",
        "status": "enforced",
        "routes": [
            "GET /admin/users/{user_id}/documents",
            "GET /admin/users/{user_id}/kyc-review",
            "GET /admin/documents/{document_id}",
        ],
        "notes": "Admin metadata views for support and compliance.",
    },
    {
        "permission": "documents.download",
        "status": "enforced",
        "routes": ["GET /admin/documents/{document_id}/download"],
        "notes": "Compliance-only signed download URLs.",
    },
    {
        "permission": "documents.verify",
        "status": "enforced",
        "routes": [
            "POST /admin/documents/{document_id}/verify",
            "POST /admin/users/{user_id}/documents/verify-kyc",
            "POST /admin/documents/{document_id}/reject",
        ],
        "notes": "Mark documents immutable after KYC approval.",
    },
    {
        "permission": "documents.legal_hold",
        "status": "enforced",
        "routes": ["POST /admin/documents/{document_id}/legal-hold"],
        "notes": "Compliance legal hold toggle.",
    },
    {
        "permission": "documents.delete",
        "status": "enforced",
        "routes": ["DELETE /admin/documents/{document_id}"],
        "notes": "Super-admin break-glass delete when not under legal hold.",
    },
    {
        "permission": "mf.jobs.read",
        "status": "enforced",
        "routes": [
            "GET /admin/mf/jobs",
            "GET /admin/mf/ingestion-runs",
            "GET /admin/mf/metrics",
        ],
        "notes": "MF scheduler job inventory, run history, and Prometheus metrics.",
    },
    {
        "permission": "mf.jobs.run",
        "status": "enforced",
        "routes": ["POST /admin/mf/jobs/{job_name}/run"],
        "notes": "Manual MF job trigger (optional force=true skips dependency guard).",
    },
    {
        "permission": "mf.amcs.read",
        "status": "enforced",
        "routes": ["GET /admin/mf/amcs"],
        "notes": "List AMC empanelment status and logo URLs.",
    },
    {
        "permission": "mf.amcs.manage",
        "status": "enforced",
        "routes": ["PATCH /admin/mf/amcs/{amc_id}"],
        "notes": "Toggle AMC empanelment and set AMFI AMC code.",
    },
    {
        "permission": "mf.catalog.read",
        "status": "enforced",
        "routes": [
            "GET /admin/mf/overview",
            "GET /admin/mf/catalog/health",
            "GET /admin/mf/catalog/health/issues",
            "GET /admin/mf/categories",
            "GET /admin/mf/funds",
            "GET /admin/mf/funds/{fund_id}",
            "GET /admin/mf/funds/{fund_id}/navs",
            "GET /admin/mf/funds/{fund_id}/content",
            "GET /admin/mf/compliance",
            "GET /admin/mf/amcs/{amc_id}/content",
            "GET /admin/mf/rules",
            "POST /admin/mf/rules/preview",
            "POST /admin/mf/funds/bulk/preview",
            "GET /admin/mf/funds/bulk/jobs",
            "GET /admin/mf/funds/bulk/jobs/{job_id}",
        ],
        "notes": "Read-only MF catalog console for categories, funds, and NAV history.",
    },
    {
        "permission": "mf.catalog.manage",
        "status": "enforced",
        "routes": [
            "PATCH /admin/mf/funds/{fund_id}",
            "PATCH /admin/mf/categories/{category_id}",
            "PUT /admin/mf/categories/{category_slug}/order",
            "POST /admin/mf/categories/{category_slug}/funds",
            "DELETE /admin/mf/categories/{category_slug}/funds/{product_id}",
            "POST /admin/mf/categories/{category_slug}/funds/bulk-amc",
        ],
        "notes": "Fund/category catalog overrides, per-category sort, and curation with audit.",
    },
    {
        "permission": "mf.content.manage",
        "status": "enforced",
        "routes": [
            "PATCH /admin/mf/compliance",
            "PATCH /admin/mf/funds/{fund_id}/content",
            "PATCH /admin/mf/amcs/{amc_id}/content",
        ],
        "notes": "Product display copy, AMC marketing content, and global compliance settings.",
    },
    {
        "permission": "mf.rules.manage",
        "status": "enforced",
        "routes": [
            "GET /admin/mf/rules",
            "POST /admin/mf/rules",
            "PATCH /admin/mf/rules/{rule_id}",
            "POST /admin/mf/rules/preview",
        ],
        "notes": "Catalog automation rule CRUD and dry-run preview.",
    },
    {
        "permission": "mf.catalog.publish",
        "status": "enforced",
        "routes": [
            "POST /admin/mf/rules/apply",
            "POST /admin/mf/funds/bulk",
            "POST /admin/mf/funds/bulk/preview",
            "GET /admin/mf/funds/bulk/jobs",
        ],
        "notes": "Apply rules and bulk catalog mutations; large batches use maker-checker.",
    },
]


def matrix_permission_keys() -> set[str]:
    return {entry["permission"] for entry in PERMISSION_ROUTE_MATRIX}


def entries_by_status(status: PermissionStatus) -> list[PermissionRouteEntry]:
    return [entry for entry in PERMISSION_ROUTE_MATRIX if entry["status"] == status]
