export const DISTRIBUTOR_JOB_HISTORY_TAB_IDS = ["salary", "commission"] as const;

export type DistributorJobHistoryTabId = (typeof DISTRIBUTOR_JOB_HISTORY_TAB_IDS)[number];

export function distributorJobHistoryTabTitle(tabId: DistributorJobHistoryTabId): string {
  switch (tabId) {
    case "salary":
      return "Payroll history";
    case "commission":
      return "Commission payouts";
  }
}
