import { DUMMY_BRANCH_DISTRIBUTORS } from "@/lib/dummy/branch-distributors";

export type ResidentAssignmentStatus = "pending_confirmation" | "assigned";

export type ResidentDistributorAssignment = {
  investorId: string;
  distributorId: string;
  distributorName: string;
  distributorArn: string;
  status: ResidentAssignmentStatus;
  magicLinkSentAt: string;
  confirmedAt?: string;
};

const STORAGE_KEY = "zynd-resident-distributor-assignments";

export function getBranchDistributorsForAssignment() {
  return DUMMY_BRANCH_DISTRIBUTORS.filter((row) => row.status === "Active");
}

export function readResidentAssignments(): Record<string, ResidentDistributorAssignment> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ResidentDistributorAssignment>;
  } catch {
    return {};
  }
}

export function writeResidentAssignments(map: Record<string, ResidentDistributorAssignment>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function buildDemoMagicLink(investorId: string): string {
  return `https://app.zynd.in/assign-distributor?token=demo-${investorId}`;
}
