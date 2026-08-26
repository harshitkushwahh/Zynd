import { DISTRIBUTOR_CLIENT_PROFILE_FALLBACK_SRC } from "@/lib/distributor-client-profile-hero";
import type { DistributorClientFamilyGroup } from "@/lib/distributor-types";

export function familyGroupAvatarSrc(group: DistributorClientFamilyGroup): string {
  if (group.avatarUrl?.trim()) return group.avatarUrl.trim();
  const head = group.members.find((member) => member.role === "head");
  if (head?.profileImageUrl?.trim()) return head.profileImageUrl.trim();
  return DISTRIBUTOR_CLIENT_PROFILE_FALLBACK_SRC;
}

export function familyGroupAvatarInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function familyGroupDescription(
  group: DistributorClientFamilyGroup,
  fallback: string,
): string {
  return group.description?.trim() || fallback;
}
