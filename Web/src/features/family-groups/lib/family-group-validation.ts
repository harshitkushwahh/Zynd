/** Mirrors Backend/app/application/family_groups/constants.py */
export const FAMILY_GROUP_LIMITS = {
  titleMax: 80,
  descriptionMax: 500,
  tagMax: 32,
  nicknameMax: 64,
  customBadgeMax: 64,
  groupsPerUser: 5,
  membersPerGroup: 12,
} as const;

export type FamilyGroupFormFieldErrors = {
  title?: string;
  description?: string;
  tag?: string;
  email?: string;
  customBadgeLabel?: string;
  nickname?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function validateFamilyGroupTitle(title: string): string | undefined {
  const trimmed = title.trim();
  if (!trimmed) return "Group name is required.";
  if (trimmed.length > FAMILY_GROUP_LIMITS.titleMax) {
    return `Group name must be at most ${FAMILY_GROUP_LIMITS.titleMax} characters.`;
  }
  return undefined;
}

export function validateFamilyGroupDescription(description: string): string | undefined {
  const trimmed = description.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > FAMILY_GROUP_LIMITS.descriptionMax) {
    return `Description must be at most ${FAMILY_GROUP_LIMITS.descriptionMax} characters.`;
  }
  return undefined;
}

export function validateFamilyGroupTag(tag: string): string | undefined {
  const trimmed = tag.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > FAMILY_GROUP_LIMITS.tagMax) {
    return `Tag must be at most ${FAMILY_GROUP_LIMITS.tagMax} characters.`;
  }
  return undefined;
}

export function validateFamilyGroupForm(input: {
  title: string;
  description?: string;
  tag?: string;
}): FamilyGroupFormFieldErrors {
  return {
    title: validateFamilyGroupTitle(input.title),
    description: validateFamilyGroupDescription(input.description ?? ""),
    tag: validateFamilyGroupTag(input.tag ?? ""),
  };
}

export function hasFamilyGroupFormErrors(errors: FamilyGroupFormFieldErrors) {
  return Object.values(errors).some(Boolean);
}

export function validateInviteEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) return "Email address is required.";
  if (!EMAIL_PATTERN.test(trimmed)) return "Enter a valid email address.";
  return undefined;
}

export function validateCustomBadgeLabel(label: string): string | undefined {
  const trimmed = label.trim();
  if (!trimmed) return "Custom badge label is required.";
  if (trimmed.length > FAMILY_GROUP_LIMITS.customBadgeMax) {
    return `Custom badge must be at most ${FAMILY_GROUP_LIMITS.customBadgeMax} characters.`;
  }
  return undefined;
}

export function validateMemberNickname(nickname: string): string | undefined {
  const trimmed = nickname.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > FAMILY_GROUP_LIMITS.nicknameMax) {
    return `Nickname must be at most ${FAMILY_GROUP_LIMITS.nicknameMax} characters.`;
  }
  return undefined;
}

export function validateInviteForm(input: {
  email: string;
  badgeKey?: string;
  customBadgeLabel?: string;
}) {
  const errors: FamilyGroupFormFieldErrors = {
    email: validateInviteEmail(input.email),
  };

  if (input.badgeKey === "custom") {
    errors.customBadgeLabel = validateCustomBadgeLabel(input.customBadgeLabel ?? "");
  }

  return errors;
}
