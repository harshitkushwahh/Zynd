const KYC_ESIGN_RESUME_KEY = "kyc_esign_resume";
const KYC_ESIGN_RETURN_HANDLED_KEY = "kyc_esign_return_handled";

function buildEsignReturnSignature(formId: string | null, status: string | null): string {
  return `${formId ?? ""}:${status ?? ""}`;
}

function isEsignReturnAlreadyHandled(signature: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(KYC_ESIGN_RETURN_HANDLED_KEY) === signature;
  } catch {
    return false;
  }
}

export function markEsignReturnHandledFromSearch(
  search = typeof window === "undefined" ? "" : window.location.search,
): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.get("kyc_esign_return") !== "1") return;
  const signature = buildEsignReturnSignature(
    params.get("kyc_form_id") ?? params.get("kyc_form"),
    params.get("status"),
  );
  try {
    sessionStorage.setItem(KYC_ESIGN_RETURN_HANDLED_KEY, signature);
  } catch {
    // ignore
  }
}

export function isEsignReturnAlreadyHandledFromSearch(
  search = typeof window === "undefined" ? "" : window.location.search,
): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.get("kyc_esign_return") !== "1") return false;
  const signature = buildEsignReturnSignature(
    params.get("kyc_form_id") ?? params.get("kyc_form"),
    params.get("status"),
  );
  return isEsignReturnAlreadyHandled(signature);
}

export function markPendingEsignResume(formId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      KYC_ESIGN_RESUME_KEY,
      JSON.stringify({ formId: formId ?? null, startedAt: Date.now() }),
    );
  } catch {
    // ignore
  }
}

export function clearPendingEsignResume(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KYC_ESIGN_RESUME_KEY);
  } catch {
    // ignore
  }
}

export function hasPendingEsignResume(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(KYC_ESIGN_RESUME_KEY) != null;
  } catch {
    return false;
  }
}

export type EsignReturnParseResult =
  | { kind: "none" }
  | { kind: "success" }
  | { kind: "incomplete"; reason?: string | null };

export function parseEsignReturnFromSearch(
  search = typeof window === "undefined" ? "" : window.location.search,
): EsignReturnParseResult {
  const params = new URLSearchParams(search);
  if (params.get("kyc_esign_return") !== "1") {
    return { kind: "none" };
  }
  const status = (params.get("status") ?? "").toLowerCase();
  if (status === "successful" || status === "success") {
    return { kind: "success" };
  }
  return {
    kind: "incomplete",
    reason: params.get("error") ?? params.get("reason"),
  };
}

export function stripEsignReturnParams(params: URLSearchParams): void {
  params.delete("kyc_esign_return");
  params.delete("kyc_form");
  params.delete("kyc_form_id");
  params.delete("status");
  params.delete("error");
  params.delete("reason");
}
