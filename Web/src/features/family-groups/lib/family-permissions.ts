import type { FamilyGroupRole } from "@/features/family-groups/api/family-groups-api";

export function canManageMembers(myRole: FamilyGroupRole | null | undefined): boolean {
  return myRole === "head";
}

export function canEditMember(
  myRole: FamilyGroupRole | null | undefined,
  targetRole: FamilyGroupRole,
  currentUserId: string,
  targetUserId: string,
): boolean {
  return (
    myRole === "head" &&
    currentUserId !== targetUserId &&
    targetRole !== "head"
  );
}

export function canRemoveMember(
  myRole: FamilyGroupRole | null | undefined,
  targetRole: FamilyGroupRole,
  currentUserId: string,
  targetUserId: string,
): boolean {
  return canEditMember(myRole, targetRole, currentUserId, targetUserId);
}

export function canTransferHeadToMember(
  myRole: FamilyGroupRole | null | undefined,
  targetRole: FamilyGroupRole,
  currentUserId: string,
  targetUserId: string,
): boolean {
  return (
    myRole === "head" &&
    currentUserId !== targetUserId &&
    targetRole !== "head"
  );
}

export function canEditNickname(
  myRole: FamilyGroupRole | null | undefined,
  currentUserId: string,
  targetUserId: string,
): boolean {
  if (currentUserId === targetUserId) return true;
  return myRole === "head";
}

export function canLeaveGroup(
  myRole: FamilyGroupRole | null | undefined,
  memberCount: number,
): boolean {
  if (!myRole) return false;
  if (myRole !== "head") return true;
  return memberCount <= 1;
}

export function leaveGroupBlockedReason(
  myRole: FamilyGroupRole | null | undefined,
  memberCount: number,
): string | null {
  if (myRole === "head" && memberCount > 1) {
    return "transfer_head_first";
  }
  return null;
}
