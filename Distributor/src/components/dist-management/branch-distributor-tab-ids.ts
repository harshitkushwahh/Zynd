export const BRANCH_DISTRIBUTOR_TAB_IDS = [
  "overview",
  "clients",
  "transactions",
  "sips",
  "reports",
  "compliance",
  "work",
] as const;

export type BranchDistributorTabId = (typeof BRANCH_DISTRIBUTOR_TAB_IDS)[number];

export const BRANCH_DISTRIBUTOR_TAB_LABELS: Record<BranchDistributorTabId, string> = {
  overview: "Overview",
  clients: "Clients",
  transactions: "Transactions",
  sips: "SIPs",
  reports: "Reports",
  compliance: "Compliance",
  work: "Work",
};
