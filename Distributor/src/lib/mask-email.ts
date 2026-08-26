/** Matches backend auth email masking (pin reset, account hints). */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const [local, domain] = trimmed.split("@");
  if (!local || !domain) return trimmed;

  const maskedLocal =
    local.length <= 2 ? `${local.slice(0, 1)}*` : `${local.slice(0, 1)}${"*".repeat(local.length - 2)}${local.slice(-1)}`;

  return `${maskedLocal}@${domain}`;
}
