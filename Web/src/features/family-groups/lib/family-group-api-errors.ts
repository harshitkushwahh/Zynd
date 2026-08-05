import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";

const FAMILY_GROUP_ERROR_MESSAGES: Record<string, string> = {
  invalid_title: "Enter a valid group name.",
  invalid_description: "Description is too long.",
  invalid_tag: "Tag is too long.",
  group_limit_reached: copy.familyGroups.limitReachedDescription(5),
  group_not_found: "This family group was no longer found.",
  group_archived: "This family group is archived.",
  forbidden: "You do not have permission to do that.",
  member_not_found: "That member was not found in this group.",
  invalid_email: "Enter a valid email address.",
  self_invite: "You cannot invite yourself.",
  invitee_unavailable: "This account cannot be invited right now.",
  group_full: "This group has reached its member limit.",
  file_too_large: "Group icon is too large.",
  invalid_badge: "Choose a valid relationship badge.",
  invalid_invite: "This invitation link is invalid or expired.",
  invite_expired: "This invitation has expired.",
  invite_revoked: "This invitation was withdrawn.",
  invite_already_used: "This invitation has already been used.",
  invite_declined: "This invitation was declined.",
  invite_not_found: "Invitation not found.",
  invite_not_pending: "Only pending invitations can be updated.",
  already_member: "This person is already in the group.",
  invalid_role: "Choose a valid member role.",
  invalid_request: "Nothing was changed.",
  head_cannot_leave: copy.familyGroups.detail.leaveBlockedTransferFirst,
};

export function mapFamilyGroupErrorCode(code: string | undefined, fallback: string) {
  if (!code) return fallback;
  return FAMILY_GROUP_ERROR_MESSAGES[code] ?? fallback;
}

export function resolveFamilyGroupApiError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return mapFamilyGroupErrorCode(error.code, error.message || fallback);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
