const CLIENT_ID_SUFFIX = "@zynd";
const MAX_PREFIX_LEN = 48;

function sanitizeClientIdToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeMobileDigits(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/** Mirrors Backend `build_client_id_candidate` — email local part + mobile digits + @zynd. */
export function buildInvestorClientCodeCandidate(email: string, mobile: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const localPart = normalizedEmail.split("@")[0] ?? "";
  const tokens = localPart.split(/[._+\-]+/).filter(Boolean);
  const first = sanitizeClientIdToken(tokens[0] ?? "") || "user";
  const second = sanitizeClientIdToken(tokens[1] ?? "");
  const prefix = (first + second).slice(0, MAX_PREFIX_LEN) || "user";
  const phoneDigits = normalizeMobileDigits(mobile);
  return `${prefix}${phoneDigits}${CLIENT_ID_SUFFIX}`;
}

export function isPlaceholderInvestorClientCode(clientCode: string | null | undefined): boolean {
  if (!clientCode) return true;
  return clientCode.startsWith("test-") && clientCode.endsWith(CLIENT_ID_SUFFIX);
}

export function formatInvestorClientCodeDisplay(clientCode: string | null | undefined): string {
  if (!clientCode || isPlaceholderInvestorClientCode(clientCode)) {
    return "—";
  }
  return clientCode;
}

export function resolveInvestorClientCodeDisplay(
  clientCode: string | null | undefined,
  email?: string | null,
  mobile?: string | null,
): string {
  if (clientCode && !isPlaceholderInvestorClientCode(clientCode)) {
    return clientCode;
  }

  const normalizedEmail = email?.trim() ?? "";
  const normalizedMobile = normalizeMobileDigits(mobile ?? "");
  if (normalizedEmail.includes("@") && normalizedMobile.length === 10) {
    return buildInvestorClientCodeCandidate(normalizedEmail, normalizedMobile);
  }

  return formatInvestorClientCodeDisplay(clientCode);
}
