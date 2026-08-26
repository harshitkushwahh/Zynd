import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";

export const MITRA_SUPER_HEAD_ROLE_KEY = "mitra_super_head";
export const MITRA_STATE_HEAD_ROLE_KEY = "mitra_state_head";
export const MITRA_MANAGER_ROLE_KEY = "mitra_manager";
export const MITRA_ROLE_KEY = "mitra";
export const SUPER_ADMIN_ROLE_KEY = "super_admin";

export function hasAdminConsoleAccess(roleKeys: string[]): boolean {
  return (
    roleKeys.includes(SUPER_ADMIN_ROLE_KEY) ||
    roleKeys.includes(MITRA_SUPER_HEAD_ROLE_KEY) ||
    roleKeys.includes(MITRA_STATE_HEAD_ROLE_KEY)
  );
}

export function isDistributorConsoleOnlyUser(roleKeys: string[]): boolean {
  const hasDistributorRole = roleKeys.some(
    (key) => key === MITRA_MANAGER_ROLE_KEY || key === MITRA_ROLE_KEY,
  );
  return hasDistributorRole && !hasAdminConsoleAccess(roleKeys);
}

export type MitraHierarchyPersona = "super_head" | "state_head";

export function resolveMitraHierarchyPersona(roleKeys: string[]): MitraHierarchyPersona | null {
  if (
    roleKeys.includes(SUPER_ADMIN_ROLE_KEY) ||
    roleKeys.includes(MITRA_SUPER_HEAD_ROLE_KEY)
  ) {
    return "super_head";
  }
  if (roleKeys.includes(MITRA_STATE_HEAD_ROLE_KEY)) {
    return "state_head";
  }
  return null;
}

export function resolveMitraConsoleTitle(roleKeys: string[]): string {
  const persona = resolveMitraHierarchyPersona(roleKeys);
  if (persona === "state_head") return MITRA_HIERARCHY_COPY.stateHead;
  if (persona === "super_head") return MITRA_HIERARCHY_COPY.superHead;
  return MITRA_HIERARCHY_COPY.superHead;
}

export function resolveMitraNavDescription(roleKeys: string[]): string {
  const persona = resolveMitraHierarchyPersona(roleKeys);
  if (persona === "state_head") {
    return MITRA_HIERARCHY_COPY.stateHeadNavDescription;
  }
  return MITRA_HIERARCHY_COPY.navDescription;
}

export function mitraHierarchyDocumentTitle(roleKeys: string[], section?: string) {
  const title = resolveMitraConsoleTitle(roleKeys);
  if (!section) return title;
  return `${title} · ${section}`;
}

export function resolveAdminLandingPath(roleKeys: string[]): string {
  if (resolveMitraHierarchyPersona(roleKeys)) {
    return "/dashboard/distributor-head";
  }
  return "/dashboard";
}

export function isMitraStateHeadOnly(roleKeys: string[]): boolean {
  return resolveMitraHierarchyPersona(roleKeys) === "state_head";
}
