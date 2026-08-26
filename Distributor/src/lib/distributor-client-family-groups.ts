import type { DistributorClientFamilyGroup } from "@/lib/distributor-types";

/**
 * Distributors may open family group detail only when the viewed client owns the group.
 * Member-only memberships (someone else's group) are hidden on the Family tab and blocked by URL.
 */
export function canDistributorAccessClientFamilyGroup(
  group: DistributorClientFamilyGroup,
  clientInDistributorBook: boolean,
): boolean {
  if (!clientInDistributorBook) return true;
  return group.role === "owner";
}

export function filterDistributorVisibleFamilyGroups(
  groups: DistributorClientFamilyGroup[],
  clientInDistributorBook: boolean,
): DistributorClientFamilyGroup[] {
  if (!clientInDistributorBook) return groups;
  return groups.filter((group) => canDistributorAccessClientFamilyGroup(group, clientInDistributorBook));
}
