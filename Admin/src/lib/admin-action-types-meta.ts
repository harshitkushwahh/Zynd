export type AdminActionTypeEntry = {
  key: string;
  label: string;
  description: string;
  makerChecker: boolean;
  triggeredBy: string;
  requestPermission: string;
  approvePermission: string;
};

/** Mirrors Backend AdminActionType + maker-checker wiring. */
export const ADMIN_ACTION_TYPES: AdminActionTypeEntry[] = [
  {
    key: "account_suspend",
    label: "Account suspend",
    description: "Suspend a customer account (maker-checker) or immediately suspend a platform admin via Compliance → Admin accounts.",
    makerChecker: true,
    triggeredBy: "POST /admin/users/{user_id}/suspend (pending) or POST /admin/admin-accounts/{user_id}/access-hold (immediate)",
    requestPermission: "users.suspend or admin.accounts.manage",
    approvePermission: "admin_actions.approve (customer suspend only)",
  },
  {
    key: "account_unsuspend",
    label: "Account unsuspend",
    description: "Restore a suspended customer (maker-checker) or immediately restore a platform admin via Compliance → Admin accounts.",
    makerChecker: true,
    triggeredBy: "POST /admin/users/{user_id}/unsuspend (pending) or POST /admin/admin-accounts/{user_id}/restore-access (immediate)",
    requestPermission: "users.suspend or admin.accounts.manage",
    approvePermission: "admin_actions.approve (customer unsuspend only)",
  },
  {
    key: "encryption_rotate_mfa",
    label: "Rotate MFA encryption keys",
    description: "Re-encrypt MFA secrets with the current platform key version.",
    makerChecker: true,
    triggeredBy: "POST /admin/encryption/rotate-mfa-keys",
    requestPermission: "encryption.rotate",
    approvePermission: "admin_actions.approve",
  },
  {
    key: "deletion_executor_run",
    label: "Run deletion executor",
    description: "Process due customer account deletion requests in the compliance pipeline.",
    makerChecker: true,
    triggeredBy: "POST /admin/deletions/run-executor",
    requestPermission: "deletion.execute",
    approvePermission: "admin_actions.approve",
  },
  {
    key: "security_config_update",
    label: "Security config update",
    description: "Apply a platform security configuration change.",
    makerChecker: true,
    triggeredBy: "POST /admin/security/config/update",
    requestPermission: "security.manage",
    approvePermission: "admin_actions.approve",
  },
  {
    key: "mf_catalog_bulk_apply",
    label: "MF catalog bulk apply",
    description: "Execute a bulk mutual fund catalog mutation job.",
    makerChecker: true,
    triggeredBy: "POST /admin/mf/funds/bulk",
    requestPermission: "mf.catalog.publish",
    approvePermission: "admin_actions.approve",
  },
  {
    key: "mf_catalog_rules_apply",
    label: "MF catalog rules apply",
    description: "Apply automation rules across the mutual fund catalog.",
    makerChecker: true,
    triggeredBy: "POST /admin/mf/rules/apply",
    requestPermission: "mf.catalog.publish",
    approvePermission: "admin_actions.approve",
  },
];

export function adminActionTypeLabel(key: string) {
  return ADMIN_ACTION_TYPES.find((item) => item.key === key)?.label ?? key.replaceAll("_", " ");
}
