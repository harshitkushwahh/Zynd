import type { FamilyGroupSummary } from "@/features/family-groups/api/family-groups-api";

export function orderFamilyGroupsForTabs(
  groups: FamilyGroupSummary[],
  pinnedGroupId: string | null | undefined,
): FamilyGroupSummary[] {
  if (!pinnedGroupId) return groups;
  const pinnedIndex = groups.findIndex((group) => group.id === pinnedGroupId);
  if (pinnedIndex <= 0) return groups;
  const pinned = groups[pinnedIndex];
  return [pinned, ...groups.filter((group) => group.id !== pinnedGroupId)];
}
