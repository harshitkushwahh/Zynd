/** Canonical family group dashboard routes. */
export function buildFamilyGroupHref(groupId?: string | null) {
  return groupId ? `/dashboard/family?group=${encodeURIComponent(groupId)}` : "/dashboard/family";
}

export function buildFamilyGroupActivityHref(groupId: string) {
  return `/dashboard/family/activity?group=${encodeURIComponent(groupId)}`;
}

/** Legacy path kept as a redirect in app/dashboard/family/[groupId]/page.tsx */
export function buildLegacyFamilyGroupHref(groupId: string) {
  return `/dashboard/family/${encodeURIComponent(groupId)}`;
}
