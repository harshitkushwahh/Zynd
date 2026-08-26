import type { AuthUser } from "@/features/auth/api/types";

export function getUserInitials(firstName?: string | null, email?: string): string {
  if (firstName?.trim()) {
    return firstName.trim().charAt(0).toUpperCase();
  }
  return email?.charAt(0).toUpperCase() ?? "U";
}

export function getDisplayName(user: Pick<AuthUser, "first_name" | "middle_name" | "last_name">): string {
  return [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(" ");
}

export function resolveDisplayName(options: {
  accountName?: string | null;
  legalFullName?: string | null;
}): string {
  const accountName = options.accountName?.trim();
  if (accountName) return accountName;

  const legalFullName = options.legalFullName?.trim();
  if (legalFullName) return legalFullName;

  return "";
}

export function greetingNameFromDisplayName(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0];
  return first || "there";
}
