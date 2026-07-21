export function buildFamilyGroupHref(groupId?: string | null) {
  return groupId ? `/dashboard/family?group=${encodeURIComponent(groupId)}` : "/dashboard/family";
}
