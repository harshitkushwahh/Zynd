import type { AdminHierarchyBranch } from "@/lib/admin-distributor-hierarchy-api";

type BranchManagerContext = Pick<
  AdminHierarchyBranch,
  "status" | "manager_id" | "manager_unavailable" | "created_by_user_id"
>;

export function canManageBranchManagers(
  branch: BranchManagerContext,
  options: {
    canManageBranches: boolean;
    canApproveBranches: boolean;
    currentUserId?: string | null;
  },
) {
  if (!options.canManageBranches || branch.status !== "active") return false;
  if (!branch.created_by_user_id) return true;
  if (branch.created_by_user_id === options.currentUserId) return true;
  return options.canApproveBranches;
}

export function canAssignBranchManager(
  branch: BranchManagerContext,
  options: Parameters<typeof canManageBranchManagers>[1],
) {
  return (
    canManageBranchManagers(branch, options) &&
    (!branch.manager_id || branch.manager_unavailable)
  );
}

export function canChangeBranchManager(
  branch: BranchManagerContext,
  options: Parameters<typeof canManageBranchManagers>[1],
) {
  return (
    canManageBranchManagers(branch, options) &&
    Boolean(branch.manager_id) &&
    !branch.manager_unavailable
  );
}

export function canRemoveBranchManager(
  branch: BranchManagerContext,
  options: Parameters<typeof canManageBranchManagers>[1],
) {
  return canManageBranchManagers(branch, options) && Boolean(branch.manager_id);
}

export function canEditBranchDetails(
  branch: Pick<AdminHierarchyBranch, "status" | "created_by_user_id">,
  options: {
    canManageBranches: boolean;
    canApproveBranches: boolean;
    currentUserId?: string | null;
  },
) {
  if (!options.canManageBranches || branch.status === "rejected") return false;
  if (!branch.created_by_user_id) return true;
  if (branch.created_by_user_id === options.currentUserId) return true;
  return options.canApproveBranches;
}

export function formatBranchManagerCell(branch: AdminHierarchyBranch) {
  if (!branch.manager_id) return "Unassigned";
  if (branch.manager_unavailable) {
    return branch.manager_name ?? "Removed manager";
  }
  return branch.manager_name ?? "Assigned";
}
