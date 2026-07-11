import { storageKeys } from "@/shared/config/storage-keys";

type TurnstileSession = {
  token: string;
  verifiedAt: number;
};

/** Cloudflare tokens expire in ~5 minutes; refresh before that. */
const TURNSTILE_SESSION_TTL_MS = 4 * 60 * 1000;

function parseSession(raw: string | null): TurnstileSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TurnstileSession;
    if (!parsed?.token || typeof parsed.verifiedAt !== "number") return null;
    if (Date.now() - parsed.verifiedAt > TURNSTILE_SESSION_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readTurnstileSession(): string | null {
  if (typeof window === "undefined") return null;
  return parseSession(sessionStorage.getItem(storageKeys.turnstileSession))?.token ?? null;
}

export function writeTurnstileSession(token: string) {
  if (typeof window === "undefined" || !token) return;
  const payload: TurnstileSession = { token, verifiedAt: Date.now() };
  sessionStorage.setItem(storageKeys.turnstileSession, JSON.stringify(payload));
}

export function clearTurnstileSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(storageKeys.turnstileSession);
}

export function hasActiveTurnstileSession(): boolean {
  return Boolean(readTurnstileSession());
}
