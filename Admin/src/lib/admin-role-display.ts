import type { AdminRole } from "@/lib/admin-api";
import { getRoleCoveragePercent } from "@/lib/admin-capabilities";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

export const SUPER_ADMIN_ROLE_KEY = "super_admin";
export const MITRA_SUPER_HEAD_ROLE_KEY = "mitra_super_head";
export const MITRA_STATE_HEAD_ROLE_KEY = "mitra_state_head";
export const MITRA_MANAGER_ROLE_KEY = "mitra_manager";
export const MITRA_ROLE_KEY = "mitra";

const BUILTIN_ROLE_KEYS = new Set([
  SUPER_ADMIN_ROLE_KEY,
  MITRA_SUPER_HEAD_ROLE_KEY,
  MITRA_STATE_HEAD_ROLE_KEY,
  MITRA_MANAGER_ROLE_KEY,
  MITRA_ROLE_KEY,
]);

export function isBuiltinTeamRole(roleKey: string) {
  return BUILTIN_ROLE_KEYS.has(roleKey);
}

export function teamRoleBadgeVariant(roleKey: string): StatusBadgeVariant {
  switch (roleKey) {
    case SUPER_ADMIN_ROLE_KEY:
      return "destructive";
    case MITRA_SUPER_HEAD_ROLE_KEY:
      return "warning";
    case MITRA_STATE_HEAD_ROLE_KEY:
      return "info";
    case MITRA_MANAGER_ROLE_KEY:
      return "success";
    case MITRA_ROLE_KEY:
      return "neutral";
    default:
      return "info";
  }
}

export function getRoleCoverage(role: AdminRole) {
  return getRoleCoveragePercent(role.permissions);
}
