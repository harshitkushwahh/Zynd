import type { FamilyGroupMemberPreview, FamilyGroupRole } from "@/features/family-groups/api/family-groups-api";

export function familyMemberInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function familyRoleLabel(role: FamilyGroupRole | string, badgeLabel?: string | null) {
  if (badgeLabel) return badgeLabel;
  if (role === "head") return "Primary Owner";
  if (role === "contributor") return "Contributor";
  return "Member";
}

export function formatRelativeActivityTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function pickOrbitMembers(
  members: FamilyGroupMemberPreview[],
  currentUserId?: string | null,
) {
  const head = members.find((member) => member.role === "head") ?? members[0];
  const others = members.filter((member) => member.user_id !== head?.user_id);
  const self = members.find((member) => member.user_id === currentUserId);
  const center = self ?? head ?? members[0];
  const orbiting = members.filter((member) => member.user_id !== center?.user_id).slice(0, 6);
  return { center, orbiting };
}
