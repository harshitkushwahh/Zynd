import {
  isDigilockerReturnAlreadyHandledFromSearch,
} from "@/features/kyc/lib/kyc-digilocker-return";
import {
  isEsignReturnAlreadyHandledFromSearch,
  stripEsignReturnParams,
} from "@/features/kyc/lib/kyc-esign-return";

/**
 * DigiLocker / eSign in a companion dialog + centered popup (default).
 * Opt out with NEXT_PUBLIC_KYC_PARTNER_FULL_REDIRECT=1 (countdown + full-page redirect).
 */
export function isKycPartnerEmbedEnabled(): boolean {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_KYC_PARTNER_FULL_REDIRECT === "1") {
    return false;
  }
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_KYC_PARTNER_EMBED === "0") {
    return false;
  }
  return true;
}

export const KYC_PARTNER_EMBED_RETURN_MESSAGE = "kyc:partner-embed-return" as const;

/** Same-origin tabs receive partner popup returns when `window.opener` is unavailable. */
export const KYC_PARTNER_RETURN_BROADCAST = "zynd_kyc_partner_return" as const;

const PARTNER_EMBED_RETURN_DEDUPE_KEY = "kyc_partner_embed_return_dedupe";
const PARTNER_EMBED_RETURN_DEDUPE_MS = 4_000;

export type KycPartnerEmbedReturnMessage = {
  type: typeof KYC_PARTNER_EMBED_RETURN_MESSAGE;
  search: string;
  pathname: string;
};

const KYC_POA_PROOF_RETURN_HANDLED_KEY = "kyc_poa_proof_return_handled";

function normalizeSearch(search: string): string {
  if (!search) return "";
  return search.startsWith("?") ? search.slice(1) : search;
}

/** Full-page partner callbacks only — not used for popup embed-return postMessage. */
export function hasKycPartnerReturnInUrl(
  search = typeof window === "undefined" ? "" : window.location.search,
): boolean {
  if (!search) return false;
  const params = new URLSearchParams(normalizeSearch(search));
  if (params.get("kyc_esign_return") === "1") return true;
  if (params.get("kyc_digilocker_return") === "1") return true;
  if (params.get("poa_proof_return") === "1" || params.get("kyc_proof_return") === "1") return true;
  if (params.get("identity_document") && params.get("status")) return true;
  return false;
}

function poaProofReturnSignatureFromSearch(search: string): string | null {
  const params = new URLSearchParams(normalizeSearch(search));
  const proofReturn =
    params.get("poa_proof_return") === "1" || params.get("kyc_proof_return") === "1";
  if (!proofReturn) return null;
  return `${params.get("kyc_form") ?? ""}:${params.get("status") ?? ""}`;
}

function isPoaProofReturnAlreadyHandledFromSearch(search: string): boolean {
  const signature = poaProofReturnSignatureFromSearch(search);
  if (!signature || typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(KYC_POA_PROOF_RETURN_HANDLED_KEY) === signature;
  } catch {
    return false;
  }
}

export function markPoaProofReturnHandledFromSearch(
  search = typeof window === "undefined" ? "" : window.location.search,
): void {
  const signature = poaProofReturnSignatureFromSearch(search);
  if (!signature || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KYC_POA_PROOF_RETURN_HANDLED_KEY, signature);
  } catch {
    // ignore
  }
}

/** Remove partner callback query params from the current URL (no navigation). */
export function stripKycPartnerReturnParamsFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  params.delete("kyc_digilocker_return");
  params.delete("identity_document");
  params.delete("status");
  params.delete("digilocker_error");
  stripEsignReturnParams(params);
  params.delete("poa_proof_return");
  params.delete("kyc_proof_return");
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

/**
 * True only for a fresh full-page partner return — not stale URL params from an earlier visit.
 */
export function shouldAutoOpenKycPartnerReturn(
  search = typeof window === "undefined" ? "" : window.location.search,
): boolean {
  if (!hasKycPartnerReturnInUrl(search)) return false;

  if (isDigilockerReturnAlreadyHandledFromSearch(search)) return false;
  if (isEsignReturnAlreadyHandledFromSearch(search)) return false;
  if (isPoaProofReturnAlreadyHandledFromSearch(search)) return false;

  return true;
}

/** Drop stale partner params and avoid opening KYC when the return was already consumed. */
export function reconcileKycPartnerReturnUrlOnDashboardLoad(): boolean {
  if (!hasKycPartnerReturnInUrl()) return false;
  if (shouldAutoOpenKycPartnerReturn()) return true;
  stripKycPartnerReturnParamsFromUrl();
  return false;
}

/** Dashboard URL that replays partner callback params (reopens KYC after popup return). */
export function buildKycDashboardPartnerReturnUrl(
  search: string,
  origin = typeof window === "undefined" ? "" : window.location.origin,
): string {
  const normalized = normalizeSearch(search);
  const params = new URLSearchParams(normalized);
  if (
    params.get("identity_document") &&
    params.get("status") &&
    params.get("kyc_digilocker_return") !== "1"
  ) {
    params.set("kyc_digilocker_return", "1");
  }
  const query = params.toString();
  const base = origin || "";
  return `${base}/dashboard${query ? `?${query}` : ""}`;
}

export function partnerEmbedReturnDedupeSignature(search: string): string {
  return normalizeSearch(search);
}

/** Prevent duplicate handling when both `postMessage` and BroadcastChannel fire. */
export function claimKycPartnerEmbedReturn(search: string): boolean {
  if (typeof window === "undefined") return true;
  const signature = partnerEmbedReturnDedupeSignature(search);
  try {
    const raw = sessionStorage.getItem(PARTNER_EMBED_RETURN_DEDUPE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { signature?: string; at?: number };
      if (
        parsed.signature === signature &&
        typeof parsed.at === "number" &&
        Date.now() - parsed.at < PARTNER_EMBED_RETURN_DEDUPE_MS
      ) {
        return false;
      }
    }
    sessionStorage.setItem(
      PARTNER_EMBED_RETURN_DEDUPE_KEY,
      JSON.stringify({ signature, at: Date.now() }),
    );
    return true;
  } catch {
    return true;
  }
}

export function isKycPartnerEmbedReturnMessage(data: unknown): data is KycPartnerEmbedReturnMessage {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return (
    record.type === KYC_PARTNER_EMBED_RETURN_MESSAGE &&
    typeof record.search === "string" &&
    typeof record.pathname === "string"
  );
}
