export const SUPPORT_AGENT_ROLE_KEY = "support_agent";
export const SUPPORT_LEAD_ROLE_KEY = "support_lead";

const SUPPORT_CONSOLE_ROLE_KEYS = new Set([SUPPORT_AGENT_ROLE_KEY, SUPPORT_LEAD_ROLE_KEY]);

export function hasSupportConsoleAccess(roleKeys: string[]): boolean {
  return roleKeys.some((key) => SUPPORT_CONSOLE_ROLE_KEYS.has(key));
}

export function resolvePrimarySupportRoleKey(roleKeys: string[]): string {
  if (roleKeys.includes(SUPPORT_LEAD_ROLE_KEY)) {
    return SUPPORT_LEAD_ROLE_KEY;
  }
  if (roleKeys.includes(SUPPORT_AGENT_ROLE_KEY)) {
    return SUPPORT_AGENT_ROLE_KEY;
  }
  return roleKeys[0] ?? SUPPORT_AGENT_ROLE_KEY;
}
