export function maskPanNumber(pan: string) {
  const normalized = pan.trim().toUpperCase();
  if (normalized.length <= 2) return normalized;

  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const maskedMiddle = "*".repeat(normalized.length - 2);

  return `${first}${maskedMiddle}${last}`;
}
