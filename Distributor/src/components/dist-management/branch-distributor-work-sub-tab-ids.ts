export const BRANCH_DISTRIBUTOR_WORK_SUB_TAB_IDS = [
  "hours",
  "attendance",
  "leave",
] as const;

export type BranchDistributorWorkSubTabId = (typeof BRANCH_DISTRIBUTOR_WORK_SUB_TAB_IDS)[number];

export const BRANCH_DISTRIBUTOR_WORK_SUB_TAB_LABELS: Record<
  BranchDistributorWorkSubTabId,
  string
> = {
  hours: "Working hours",
  attendance: "Attendance",
  leave: "Leave",
};
