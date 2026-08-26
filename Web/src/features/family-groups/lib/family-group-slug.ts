import type { FamilyGroupSummary } from "@/features/family-groups/api/family-groups-api";
import { isFundUuid, slugifyFundName } from "@/features/invest/lib/mf-fund-url";

export function familyGroupSlug(group: Pick<FamilyGroupSummary, "id" | "title" | "tag">): string {
  const fromTag = group.tag?.trim();
  if (fromTag) return slugifyFundName(fromTag);
  return slugifyFundName(group.title);
}

export function familyGroupTabLabel(group: Pick<FamilyGroupSummary, "title" | "tag">): string {
  const title = group.title.trim();
  if (title && !isFundUuid(title)) return title;
  const tag = group.tag?.trim();
  if (tag) return tag;
  return title || "Family group";
}

export function resolveFamilyGroupFromRef(
  groups: FamilyGroupSummary[],
  ref: string | null | undefined,
): FamilyGroupSummary | null {
  if (!ref) return null;

  const decoded = decodeURIComponent(ref).trim();
  if (!decoded) return null;

  const byId = groups.find((group) => group.id === decoded);
  if (byId) return byId;

  const slugMatches = groups.filter((group) => familyGroupSlug(group) === decoded);
  if (slugMatches.length === 1) return slugMatches[0];

  return null;
}

export function resolveFamilyGroupId(
  groups: FamilyGroupSummary[],
  ref: string | null | undefined,
): string | null {
  return resolveFamilyGroupFromRef(groups, ref)?.id ?? null;
}

export function familyGroupSlugForList(
  group: Pick<FamilyGroupSummary, "id" | "title" | "tag">,
  groups: Pick<FamilyGroupSummary, "id" | "title" | "tag">[],
): string {
  const base = familyGroupSlug(group);
  const collisions = groups.filter((item) => familyGroupSlug(item) === base);
  if (collisions.length <= 1) return base;
  return `${base}-${group.id.slice(0, 8)}`;
}
