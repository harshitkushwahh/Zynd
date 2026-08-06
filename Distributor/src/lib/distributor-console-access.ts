import type { DistributorSessionUser } from "@/lib/distributor-session-types";

export const DISTRIBUTOR_MANAGER_ROLE_KEY = "distributor_manager";
export const DISTRIBUTOR_PARTNER_ROLE_KEY = "distributor_console";

export type DistributorConsolePersona = "branch_manager" | "distributor";

export function resolveDistributorConsolePersona(
  roleKeys: string[],
): DistributorConsolePersona | null {
  const normalized = new Set(roleKeys);
  if (normalized.has(DISTRIBUTOR_MANAGER_ROLE_KEY)) {
    return "branch_manager";
  }
  if (normalized.has(DISTRIBUTOR_PARTNER_ROLE_KEY)) {
    return "distributor";
  }
  return null;
}

export function mapPersonaToSessionRole(
  persona: DistributorConsolePersona,
): DistributorSessionUser["role"] {
  return persona === "branch_manager" ? "branch_manager" : "distributor";
}
