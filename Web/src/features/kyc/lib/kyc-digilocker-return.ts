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

export function buildDigilockerReturnSignature(
  documentId: string | null,
  fetchStatus: string | null,
): string {
  return `${documentId ?? ""}:${fetchStatus ?? ""}`;
}

function buildReturnSignature(documentId: string | null, fetchStatus: string | null): string {
  return buildDigilockerReturnSignature(documentId, fetchStatus);
}

export function digilockerReturnSignatureFromSearch(
  search = typeof window === "undefined" ? "" : window.location.search,
): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const hasReturn =
    params.get("kyc_digilocker_return") === "1" ||
    Boolean(params.get("identity_document") && params.get("status"));
  if (!hasReturn) return null;
  return buildReturnSignature(
    params.get("identity_document"),
    params.get("status"),
  );
}

export function isDigilockerReturnAlreadyHandledFromSearch(
  search = typeof window === "undefined" ? "" : window.location.search,
): boolean {
  const signature = digilockerReturnSignatureFromSearch(search);
  if (!signature) return false;
  return isReturnAlreadyHandled(signature);
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

export function markPendingDigilockerResume(identityDocumentId?: string | null): void {
  const existing = readPersistedReturn();
  writePersistedReturn({
    documentId: identityDocumentId ?? existing?.documentId ?? null,
    fetchStatus: existing?.fetchStatus ?? null,
    error: existing?.error ?? null,
  });
}

function captureFinprimPostbackFromSearch(
  search = typeof window === "undefined" ? "" : window.location.search,
): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(search);
  const documentId = params.get("identity_document");
  const fetchStatus = params.get("status");
  if (!documentId || !fetchStatus) {
    return false;
  }
  writePersistedReturn({
    documentId,
    fetchStatus,
    error: params.get("digilocker_error"),
  });
  return true;
}

export function persistDigilockerReturnFromSearch(
  search = typeof window === "undefined" ? "" : window.location.search,
): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(search);
  if (params.get("kyc_digilocker_return") === "1") {
    writePersistedReturn({
      documentId: params.get("identity_document"),
      fetchStatus: params.get("status"),
      error: params.get("digilocker_error"),
    });
    return true;
  }
  if (captureFinprimPostbackFromSearch(search)) {
    return true;
  }
  return false;
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

async function finalizeIdentityDocument(documentId: string): Promise<DigilockerReturnResult> {
  const result = await fetchKycIdentityDocument(documentId);
  if (!result.success) {
    return {
      kind: "failed",
      reason: result.reason?.trim() || copy.kyc.digilocker.failedDescription,
    };
  }
  return {
    kind: "success",
    contactDraft: result.contact_draft ?? null,
    personalDraft: result.personal_draft ?? null,
  };
}

export async function processDigilockerReturnFromSearch(
  search: string,
  options?: { skipUrlCleanup?: boolean },
): Promise<DigilockerReturnResult> {
  if (typeof window === "undefined") return { kind: "none" };

  const normalized = search.startsWith("?") ? search : search ? `?${search}` : "";
  persistDigilockerReturnFromSearch(normalized);
  const params = new URLSearchParams(normalized.replace(/^\?/, ""));

  const persisted = readPersistedReturn();
  const isReturn =
    params.get("kyc_digilocker_return") === "1" ||
    Boolean(params.get("identity_document") && params.get("status")) ||
    Boolean(persisted?.documentId);

  if (!isReturn) return { kind: "none" };

  const documentId = params.get("identity_document") ?? persisted?.documentId ?? null;
  const fetchStatus = params.get("status") ?? persisted?.fetchStatus ?? null;
  const returnError = params.get("digilocker_error") ?? persisted?.error ?? null;
  const returnSignature = buildReturnSignature(documentId, fetchStatus);

  if (isReturnAlreadyHandled(returnSignature)) {
    if (!options?.skipUrlCleanup) {
      stripDigilockerReturnParams(params);
      replaceUrlWithoutDigilockerParams(params);
    }
    return { kind: "none" };
  }

  markReturnHandled(returnSignature);
  if (!options?.skipUrlCleanup) {
    stripDigilockerReturnParams(params);
    replaceUrlWithoutDigilockerParams(params);
  }

  if (!documentId) {
    return {
      kind: "failed",
      reason: returnError?.trim() || copy.kyc.digilocker.failedDescription,
    };
  }

  if (fetchStatus !== "successful") {
    return {
      kind: "failed",
      reason: returnError?.trim() || copy.kyc.digilocker.failedDescription,
    };
  }

  return finalizeIdentityDocument(documentId);
}

export async function processDigilockerReturnFromUrl(): Promise<DigilockerReturnResult> {
  if (typeof window === "undefined") return { kind: "none" };
  return processDigilockerReturnFromSearch(window.location.search);
}

/** After a refresh mid-DigiLocker, poll the stored identity document id once. */
export async function resumePendingDigilockerIfNeeded(): Promise<DigilockerReturnResult> {
  if (typeof window === "undefined") return { kind: "none" };

  const persisted = readPersistedReturn();
  if (!persisted?.documentId) return { kind: "none" };

  const params = new URLSearchParams(window.location.search);
  if (params.get("identity_document") || params.get("kyc_digilocker_return") === "1") {
    return processDigilockerReturnFromUrl();
  }

  if (persisted.fetchStatus === "successful") {
    const signature = buildReturnSignature(persisted.documentId, persisted.fetchStatus);
    if (isReturnAlreadyHandled(signature)) {
      return { kind: "none" };
    }
    markReturnHandled(signature);
    return finalizeIdentityDocument(persisted.documentId);
  }

  return { kind: "none" };
}
