import { fetchKycIdentityDocument } from "@/features/kyc/lib/kyc-api";
import { copy } from "@/shared/config/copy";

const DIGILOCKER_RETURN_HANDLED_KEY = "kyc_digilocker_return_handled";
const DIGILOCKER_RESUME_KEY = "kyc_digilocker_resume";

export type DigilockerReturnResult =
  | { kind: "none" }
  | { kind: "failed"; reason: string }
  | {
      kind: "success";
      contactDraft: Record<string, unknown> | null;
      personalDraft: Record<string, unknown> | null;
    };

type PersistedDigilockerReturn = {
  documentId: string | null;
  fetchStatus: string | null;
  error: string | null;
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

function writePersistedReturn(payload: PersistedDigilockerReturn): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DIGILOCKER_RESUME_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures — URL params remain the fallback.
  }
}

function readPersistedReturn(): PersistedDigilockerReturn | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DIGILOCKER_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDigilockerReturn;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      documentId: parsed.documentId ?? null,
      fetchStatus: parsed.fetchStatus ?? null,
      error: parsed.error ?? null,
    };
  } catch {
    return null;
  }
}

export function hasPendingDigilockerResume(): boolean {
  return readPersistedReturn() !== null;
}

export function markPendingDigilockerResume(): void {
  if (readPersistedReturn()) return;
  writePersistedReturn({ documentId: null, fetchStatus: null, error: null });
}

export function persistDigilockerReturnFromSearch(
  search = typeof window === "undefined" ? "" : window.location.search,
): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(search);
  if (params.get("kyc_digilocker_return") !== "1") {
    return hasPendingDigilockerResume();
  }
  writePersistedReturn({
    documentId: params.get("identity_document"),
    fetchStatus: params.get("status"),
    error: params.get("digilocker_error"),
  });
  return true;
}

export function clearPendingDigilockerResume(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DIGILOCKER_RESUME_KEY);
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

  persistDigilockerReturnFromSearch();
  const params = new URLSearchParams(window.location.search);
  const persisted = readPersistedReturn();
  const isReturn = params.get("kyc_digilocker_return") === "1" || Boolean(persisted?.documentId || persisted?.error);

  if (!isReturn) return { kind: "none" };

  const documentId = params.get("identity_document") ?? persisted?.documentId ?? null;
  const fetchStatus = params.get("status") ?? persisted?.fetchStatus ?? null;
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
