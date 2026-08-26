import { fetchKycIdentityDocument } from "@/features/kyc/lib/kyc-api";
import { copy } from "@/shared/config/copy";

const DIGILOCKER_RETURN_HANDLED_KEY = "kyc_digilocker_return_handled";

export type DigilockerReturnResult =
  | { kind: "none" }
  | { kind: "failed"; reason: string }
  | {
      kind: "success";
      contactDraft: Record<string, unknown> | null;
      personalDraft: Record<string, unknown> | null;
    };

function buildReturnSignature(documentId: string | null, fetchStatus: string | null): string {
  return `${documentId ?? ""}:${fetchStatus ?? ""}`;
}

function isReturnAlreadyHandled(signature: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(DIGILOCKER_RETURN_HANDLED_KEY) === signature;
  } catch {
    return false;
  }
}

function markReturnHandled(signature: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DIGILOCKER_RETURN_HANDLED_KEY, signature);
  } catch {
    // Ignore storage failures — worst case the failure dialog may show again.
  }
}

export function clearDigilockerReturnHandled(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DIGILOCKER_RETURN_HANDLED_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function stripDigilockerReturnParams(params: URLSearchParams): void {
  params.delete("kyc_digilocker_return");
  params.delete("identity_document");
  params.delete("status");
  params.delete("digilocker_error");
}

function replaceUrlWithoutDigilockerParams(params: URLSearchParams): void {
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

export async function processDigilockerReturnFromUrl(): Promise<DigilockerReturnResult> {
  if (typeof window === "undefined") return { kind: "none" };

  const params = new URLSearchParams(window.location.search);
  if (params.get("kyc_digilocker_return") !== "1") return { kind: "none" };

  const documentId = params.get("identity_document");
  const fetchStatus = params.get("status");
  const returnSignature = buildReturnSignature(documentId, fetchStatus);

  if (isReturnAlreadyHandled(returnSignature)) {
    stripDigilockerReturnParams(params);
    replaceUrlWithoutDigilockerParams(params);
    return { kind: "none" };
  }

  markReturnHandled(returnSignature);
  stripDigilockerReturnParams(params);
  replaceUrlWithoutDigilockerParams(params);

  if (!documentId || fetchStatus !== "successful") {
    return {
      kind: "failed",
      reason: copy.kyc.digilocker.failedDescription,
    };
  }

  const result = await fetchKycIdentityDocument(documentId);
  if (!result.success) {
    return {
      kind: "failed",
      reason: result.reason ?? copy.kyc.digilocker.failedDescription,
    };
  }

  return {
    kind: "success",
    contactDraft: result.contact_draft ?? null,
    personalDraft: result.personal_draft ?? null,
  };
}
