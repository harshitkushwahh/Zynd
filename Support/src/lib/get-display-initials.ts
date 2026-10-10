/** First two letters from display name (initials from word starts). */
export function getDisplayInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "??";

  return trimmed
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
