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
