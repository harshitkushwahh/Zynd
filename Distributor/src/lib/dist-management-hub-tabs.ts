export const DIST_MANAGEMENT_HUB_TAB_IDS = ["commissions", "performance", "reports"] as const;

export type DistManagementHubTabId = (typeof DIST_MANAGEMENT_HUB_TAB_IDS)[number];

export function isDistManagementHubTabId(value: string): value is DistManagementHubTabId {
  return (DIST_MANAGEMENT_HUB_TAB_IDS as readonly string[]).includes(value);
}

export function resolveDistManagementHubTab(
  raw: string | null | undefined,
): DistManagementHubTabId {
  if (raw && isDistManagementHubTabId(raw)) return raw;
  return "commissions";
}

export function buildDistManagementHubHref(tab?: DistManagementHubTabId): string {
  if (!tab || tab === "commissions") {
    return "/dashboard/dist-management";
  }
  return `/dashboard/dist-management?tab=${tab}`;
}

const TAB_LABELS: Record<DistManagementHubTabId, string> = {
  commissions: "Incentives",
  performance: "Team performance",
  reports: "Reports",
};

export function distManagementHubTabTitle(tabId: DistManagementHubTabId): string {
  return TAB_LABELS[tabId];
}
