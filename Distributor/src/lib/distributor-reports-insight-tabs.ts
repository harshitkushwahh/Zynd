export const DISTRIBUTOR_REPORTS_INSIGHT_TAB_IDS = ["book", "sip", "incentives"] as const;

export type DistributorReportsInsightTabId = (typeof DISTRIBUTOR_REPORTS_INSIGHT_TAB_IDS)[number];

export function distributorReportsInsightTabTitle(tabId: DistributorReportsInsightTabId): string {
  const titles: Record<DistributorReportsInsightTabId, string> = {
    book: "Book quality",
    sip: "SIP business",
    incentives: "Incentives",
  };
  return titles[tabId];
}

export function parseDistributorReportsInsightTab(
  value: string | null | undefined,
): DistributorReportsInsightTabId {
  if (value && DISTRIBUTOR_REPORTS_INSIGHT_TAB_IDS.includes(value as DistributorReportsInsightTabId)) {
    return value as DistributorReportsInsightTabId;
  }
  return "book";
}
