import type { DistributorSessionUser } from "@/lib/distributor-session-types";

export function isBranchManager(user: Pick<DistributorSessionUser, "role"> | null | undefined): boolean {
  if (!user) return false;
  return user.role === "branch_manager" || user.role === "relationship_manager";
}

export function getManagerBranchLabel(user: Pick<DistributorSessionUser, "branchName"> | null | undefined): string {
  return user?.branchName?.trim() || "Your branch";
}
