export const SUPPORT_EMPTY_VALUE = "NA";

const EMPTY_MARKERS = new Set(["", "—", "-", "–", "none", "null", "undefined"]);

export function isSupportEmptyDisplayValue(value: string | null | undefined): boolean {
  if (value == null) return true;
  return EMPTY_MARKERS.has(value.trim().toLowerCase());
}

export function normalizeSupportDisplayValue(value: string | null | undefined): string {
  if (isSupportEmptyDisplayValue(value)) return SUPPORT_EMPTY_VALUE;
  return value!.trim();
}
