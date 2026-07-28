import { copy } from "@/shared/config/copy";

const DEFAULT_FIRST_NAME = "there";
const MAX_FIRST_NAME_CHARS = 18;

export function getSupportFirstName(firstName?: string | null): string {
  const trimmed = firstName?.trim();
  if (!trimmed) return DEFAULT_FIRST_NAME;
  if (trimmed.length <= MAX_FIRST_NAME_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_FIRST_NAME_CHARS - 1)}…`;
}

export function getSupportGreeting(firstName?: string | null): string {
  return `${copy.support.greetingWave} ${copy.support.greetingHey} ${getSupportFirstName(firstName)}`;
}

export function formatSupportCardDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
