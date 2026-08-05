export function userFamilyGroupDetailHref(profilePath: string, groupId: string) {
  return `/dashboard/users/${encodeURIComponent(profilePath)}/family-group/${encodeURIComponent(groupId)}`;
}

export function userFamilyGroupsTabHref(profilePath: string) {
  return `/dashboard/users/${encodeURIComponent(profilePath)}/family`;
}
