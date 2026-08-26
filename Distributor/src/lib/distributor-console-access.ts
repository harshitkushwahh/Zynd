import type { DistributorSessionUser } from "@/lib/distributor-session-types";

export const MITRA_MANAGER_ROLE_KEY = "mitra_manager";
export const MITRA_ROLE_KEY = "mitra";
/** @deprecated Use MITRA_MANAGER_ROLE_KEY */
export const DISTRIBUTOR_MANAGER_ROLE_KEY = MITRA_MANAGER_ROLE_KEY;
/** @deprecated Use MITRA_ROLE_KEY */
export const DISTRIBUTOR_PARTNER_ROLE_KEY = MITRA_ROLE_KEY;

export type DistributorConsolePersona = "branch_manager" | "distributor";

export function resolveDistributorConsolePersona(
  roleKeys: string[],
): DistributorConsolePersona | null {
  const normalized = new Set(roleKeys);
  if (normalized.has(MITRA_MANAGER_ROLE_KEY)) {
    return "branch_manager";
  }
  if (normalized.has(MITRA_ROLE_KEY)) {
    return "distributor";
  }
  return null;
}

export function mapPersonaToSessionRole(
  persona: DistributorConsolePersona,
): DistributorSessionUser["role"] {
  return persona === "branch_manager" ? "branch_manager" : "distributor";
}
