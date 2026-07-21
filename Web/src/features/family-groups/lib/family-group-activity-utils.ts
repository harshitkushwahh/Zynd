import { Clock3, TrendingUp, UserPlus, UsersRound, type LucideIcon } from "lucide-react";

export function familyGroupActivityIcon(eventType: string): LucideIcon {
  if (eventType.includes("invite")) return UserPlus;
  if (eventType.includes("joined") || eventType.includes("member") || eventType.includes("head")) {
    return UsersRound;
  }
  if (eventType.includes("badge") || eventType.includes("role") || eventType.includes("nickname")) {
    return TrendingUp;
  }
  return Clock3;
}

export function formatFamilyGroupActivityTimestamp(value: string) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
