/** Display separator between city and locality in branch names (replaces em/en dashes). */
export const DISTRIBUTOR_BRANCH_NAME_SEPARATOR = " · ";

export function formatDistributorBranchName(branchName: string): string {
  const trimmed = branchName.trim();
  if (!trimmed) return trimmed;

  return trimmed
    .replace(/\s*—\s*/g, DISTRIBUTOR_BRANCH_NAME_SEPARATOR)
    .replace(/\s*–\s*/g, DISTRIBUTOR_BRANCH_NAME_SEPARATOR)
    .replace(/\s+-\s+/g, DISTRIBUTOR_BRANCH_NAME_SEPARATOR);
}
