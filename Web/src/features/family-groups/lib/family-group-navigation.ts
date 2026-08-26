/** Canonical family group dashboard routes. */
import type { FamilyGroupSummary } from "@/features/family-groups/api/family-groups-api";
import {
  familyGroupSlugForList,
  resolveFamilyGroupFromRef,
} from "@/features/family-groups/lib/family-group-slug";

export type FamilyGroupRouteSource = Pick<FamilyGroupSummary, "id" | "title" | "tag">;

export function buildFamilyGroupHref(group?: FamilyGroupRouteSource | null) {
  if (!group) return "/dashboard/family";
  return `/dashboard/family?group=${encodeURIComponent(familyGroupSlugForList(group, [group]))}`;
}

export function buildFamilyGroupHrefFromList(
  group: FamilyGroupRouteSource,
  groups: FamilyGroupRouteSource[],
) {
  return `/dashboard/family?group=${encodeURIComponent(familyGroupSlugForList(group, groups))}`;
}

export function buildFamilyGroupActivityHref(
  group: FamilyGroupRouteSource,
  groups: FamilyGroupRouteSource[] = [group],
) {
  return `/dashboard/family/activity?group=${encodeURIComponent(familyGroupSlugForList(group, groups))}`;
}

export function buildFamilyGroupDetailHref(
  group: FamilyGroupRouteSource,
  groups: FamilyGroupRouteSource[] = [group],
) {
  return `/dashboard/family/group?group=${encodeURIComponent(familyGroupSlugForList(group, groups))}`;
}

export function resolveFamilyGroupRouteParam(
  groups: FamilyGroupSummary[],
  ref: string | null | undefined,
) {
  return resolveFamilyGroupFromRef(groups, ref);
}

/** Legacy path kept as a redirect in app/dashboard/family/[groupId]/page.tsx */
export function buildLegacyFamilyGroupHref(groupRef: string) {
  return `/dashboard/family/${encodeURIComponent(groupRef)}`;
}
