export const BRANCH_REPORTS_TABLE_SUB_TAB_IDS = [
  "rollup",
  "kyc-pending",
  "compliance",
] as const;

export type BranchReportsTableSubTabId = (typeof BRANCH_REPORTS_TABLE_SUB_TAB_IDS)[number];

export const BRANCH_REPORTS_TABLE_SUB_TAB_LABELS: Record<
  BranchReportsTableSubTabId,
  string
> = {
  rollup: "AUM & sales roll-up",
  "kyc-pending": "KYC pending",
  compliance: "Compliance exceptions",
};
