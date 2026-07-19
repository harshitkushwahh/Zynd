export type PermissionRouteEntry = {
  permission: string;
  status: "enforced" | "mismatch" | "planned" | "partial";
  routes: string[];
  notes: string;
};

/** Mirrors Backend/app/application/admin/rbac_service.py PERMISSIONS. */
export const ADMIN_PERMISSIONS: Array<{ key: string; description: string }> = [
  { key: "security_reviews.read", description: "View flagged login security reviews" },
  { key: "security_reviews.resolve", description: "Resolve or dismiss security reviews" },
  { key: "audit.read", description: "Read audit log summaries" },
  { key: "users.read", description: "View user account summaries" },
  { key: "users.suspend", description: "Request account suspension and unsuspension" },
  { key: "admin_actions.approve", description: "Approve or reject high-impact admin action requests" },
  { key: "security.manage", description: "Request security configuration changes" },
  { key: "rbac.manage", description: "Manage admin roles and assignments" },
  { key: "encryption.rotate", description: "Rotate encrypted secrets to the current key version" },
  { key: "transactions.execute", description: "Execute money-moving transaction requests" },
  { key: "retention.read", description: "View regulatory retention schedule" },
  { key: "deletion.execute", description: "Run account deletion executor and view pending deletions" },
  { key: "documents.read", description: "View user document metadata" },
  { key: "documents.download", description: "Download user documents for compliance review" },
  { key: "documents.verify", description: "Verify KYC documents and apply WORM immutability" },
  { key: "documents.legal_hold", description: "Place or release legal hold on documents" },
  { key: "documents.delete", description: "Break-glass deletion of protected documents" },
  { key: "mf.jobs.read", description: "View MF ingestion jobs, runs, and metrics" },
  { key: "mf.jobs.run", description: "Manually trigger MF ingestion jobs" },
  { key: "mf.amcs.read", description: "View mutual fund AMC empanelment status" },
  { key: "mf.amcs.manage", description: "Update AMC empanelment and AMFI codes" },
  { key: "mf.catalog.read", description: "View mutual fund catalog, categories, and NAV history" },
  { key: "mf.catalog.manage", description: "Update mutual fund catalog visibility and investability overrides" },
  { key: "mf.content.manage", description: "Edit mutual fund display content and compliance settings" },
  { key: "mf.rules.manage", description: "Create and update mutual fund catalog automation rules" },
  { key: "mf.catalog.publish", description: "Apply catalog rules and bulk catalog mutations" },
  { key: "mf.transactions.read", description: "View MF orders, checkouts, SIP plans, mandates, and webhooks" },
  { key: "mf.transactions.manage", description: "Reconcile MF transactions, replay webhooks, and expire stale checkouts" },
];

/** Mirrors Backend/app/application/admin/permission_matrix.py (read-only admin UI). */
export const PERMISSION_ROUTE_MATRIX: PermissionRouteEntry[] = [
  { permission: "security_reviews.read", status: "enforced", routes: ["GET /admin/security-reviews"], notes: "Lists open/resolved security review items." },
  { permission: "security_reviews.resolve", status: "enforced", routes: ["POST /admin/security-reviews/{item_id}/resolve"], notes: "Resolve or dismiss a review item." },
  { permission: "users.read", status: "enforced", routes: ["GET /admin/users", "GET /admin/users/{user_id}"], notes: "List and view user account summaries." },
  { permission: "users.suspend", status: "enforced", routes: ["POST /admin/users/{user_id}/suspend", "POST /admin/users/{user_id}/unsuspend"], notes: "Maker-checker account suspension and reactivation." },
  { permission: "admin_actions.approve", status: "enforced", routes: ["GET /admin/actions", "POST /admin/actions/{action_id}/approve", "POST /admin/actions/{action_id}/reject"], notes: "Maker-checker approval queue." },
  { permission: "security.manage", status: "enforced", routes: ["GET /admin/security/config", "POST /admin/security/config/update"], notes: "Read config; updates go through maker-checker." },
  { permission: "rbac.manage", status: "enforced", routes: ["GET /admin/rbac/roles", "GET /admin/rbac/users/{user_id}/roles", "POST /admin/rbac/users/{user_id}/roles", "DELETE /admin/rbac/users/{user_id}/roles/{role_key}", "GET /admin/invitations", "POST /admin/invitations", "POST /admin/invitations/{invitation_id}/revoke", "POST /admin/invitations/{invitation_id}/resend"], notes: "List roles, assign/revoke admin role assignments, and manage admin invitations." },
  { permission: "encryption.rotate", status: "enforced", routes: ["POST /admin/encryption/rotate-mfa-keys"], notes: "Creates maker-checker action for MFA key rotation." },
  { permission: "transactions.execute", status: "enforced", routes: ["POST /admin/transactions/transfer"], notes: "Ops-initiated transfers." },
  { permission: "audit.read", status: "enforced", routes: ["GET /admin/audit", "GET /admin/zynd-logs", "GET /admin/zynd-logs/export"], notes: "Audit and provider integration logs with CSV export." },
  { permission: "retention.read", status: "enforced", routes: ["GET /admin/retention/schedule"], notes: "Lists seeded retention policies." },
  { permission: "deletion.execute", status: "enforced", routes: ["GET /admin/deletions/pending", "POST /admin/deletions/run-executor"], notes: "Pending deletions + maker-checker executor run." },
  { permission: "documents.read", status: "enforced", routes: ["GET /admin/users/{user_id}/documents", "GET /admin/users/{user_id}/kyc-review", "GET /admin/documents/{document_id}"], notes: "Admin metadata views for support and compliance." },
  { permission: "documents.download", status: "enforced", routes: ["GET /admin/documents/{document_id}/download"], notes: "Compliance-only signed download URLs." },
  { permission: "documents.verify", status: "enforced", routes: ["POST /admin/documents/{document_id}/verify", "POST /admin/users/{user_id}/documents/verify-kyc", "POST /admin/documents/{document_id}/reject"], notes: "Mark documents immutable after KYC approval." },
  { permission: "documents.legal_hold", status: "enforced", routes: ["POST /admin/documents/{document_id}/legal-hold"], notes: "Compliance legal hold toggle." },
  { permission: "documents.delete", status: "enforced", routes: ["DELETE /admin/documents/{document_id}"], notes: "Super-admin break-glass delete when not under legal hold." },
  { permission: "mf.jobs.read", status: "enforced", routes: ["GET /admin/mf/jobs", "GET /admin/mf/ingestion-runs", "GET /admin/mf/metrics"], notes: "MF scheduler job inventory, run history, and metrics." },
  { permission: "mf.jobs.run", status: "enforced", routes: ["POST /admin/mf/jobs/{job_name}/run"], notes: "Manual MF job trigger." },
  { permission: "mf.amcs.read", status: "enforced", routes: ["GET /admin/mf/amcs"], notes: "List AMC empanelment status and logo URLs." },
  { permission: "mf.amcs.manage", status: "enforced", routes: ["PATCH /admin/mf/amcs/{amc_id}"], notes: "Toggle AMC empanelment and set AMFI AMC code." },
  { permission: "mf.catalog.read", status: "enforced", routes: ["GET /admin/mf/overview", "GET /admin/mf/catalog/health", "GET /admin/mf/funds", "GET /admin/mf/funds/{fund_id}"], notes: "Read-only MF catalog console." },
  { permission: "mf.catalog.manage", status: "enforced", routes: ["PATCH /admin/mf/funds/{fund_id}", "PATCH /admin/mf/categories/{category_id}"], notes: "Fund/category catalog overrides with audit." },
  { permission: "mf.content.manage", status: "enforced", routes: ["PATCH /admin/mf/compliance", "PATCH /admin/mf/funds/{fund_id}/content", "PATCH /admin/mf/amcs/{amc_id}/content"], notes: "Product display copy and compliance settings." },
  { permission: "mf.rules.manage", status: "enforced", routes: ["GET /admin/mf/rules", "POST /admin/mf/rules", "PATCH /admin/mf/rules/{rule_id}"], notes: "Catalog automation rule CRUD and preview." },
  { permission: "mf.catalog.publish", status: "enforced", routes: ["POST /admin/mf/rules/apply", "POST /admin/mf/funds/bulk"], notes: "Apply rules and bulk catalog mutations." },
  { permission: "mf.transactions.read", status: "enforced", routes: ["GET /admin/mf/transactions/overview", "GET /admin/mf/transactions/orders", "GET /admin/mf/transactions/sip-plans", "GET /admin/mf/transactions/mandates", "GET /admin/mf/transactions/webhooks"], notes: "MF payment ops read APIs." },
  { permission: "mf.transactions.manage", status: "enforced", routes: ["POST /admin/mf/transactions/orders/{order_id}/sync", "POST /admin/mf/transactions/sip-plans/{plan_id}/sync", "POST /admin/mf/transactions/webhooks/{event_id}/replay"], notes: "Reconcile stuck MF transactions and replay webhooks." },
];

export function groupPermissionsByResource(permissions: string[]) {
  const groups = new Map<string, string[]>();
  for (const key of permissions) {
    const resource = key.split(".")[0] ?? key;
    const existing = groups.get(resource) ?? [];
    existing.push(key);
    groups.set(resource, existing);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function permissionDescription(key: string) {
  return ADMIN_PERMISSIONS.find((item) => item.key === key)?.description ?? key;
}
