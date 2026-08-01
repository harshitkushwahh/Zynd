import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export const BRANCH_INCENTIVES_TABLE_SUB_TAB_IDS = [
  "by-distributor",
  "holds-releases",
] as const;

export type BranchIncentivesTableSubTabId =
  (typeof BRANCH_INCENTIVES_TABLE_SUB_TAB_IDS)[number];

export const BRANCH_INCENTIVES_TABLE_SUB_TAB_LABELS: Record<
  BranchIncentivesTableSubTabId,
  string
> = {
  "by-distributor": ZYND_MITRA_COPY.incentiveByMitra,
  "holds-releases": "Holds & releases",
};
