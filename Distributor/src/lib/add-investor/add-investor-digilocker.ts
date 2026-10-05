import {
  fetchClientKycBootstrap,
  fetchClientKycIdentityDocument,
  startClientKycDigilocker,
} from "@/lib/distributor-client-onboarding-api";
import {
  mapBootstrapAddressDraft,
  mapBootstrapPersonalDraft,
} from "@/lib/add-investor/add-investor-kyc-bootstrap";
import type { AddInvestorAddressDraft, AddInvestorPersonalDraft } from "@/lib/add-investor/add-investor-journey";

export type ApplyClientDigilockerDocumentResult = {
  success: boolean;
  address?: AddInvestorAddressDraft;
  personal?: AddInvestorPersonalDraft;
  reason?: string;
};

export async function applyClientDigilockerIdentityDocument(
  clientUserId: string,
  documentId: string,
): Promise<ApplyClientDigilockerDocumentResult> {
  const result = await fetchClientKycIdentityDocument(clientUserId, documentId);
  if (!result.success) {
    return { success: false, reason: result.reason?.trim() || "DigiLocker fetch failed." };
  }
  const bootstrap = await fetchClientKycBootstrap(clientUserId);
  const contact = result.contact_draft ?? bootstrap.contact_draft ?? null;
  const personalRaw = result.personal_draft ?? bootstrap.personal_draft ?? null;
  const address = mapBootstrapAddressDraft(contact);
  const personal = mapBootstrapPersonalDraft(personalRaw);
  if (!address) {
    return { success: false, reason: "Address could not be loaded from DigiLocker." };
  }
  return { success: true, address, personal: personal ?? undefined };
}

export type BeginClientDigilockerResult =
  | { outcome: "redirect" }
  | { outcome: "inline"; applied: ApplyClientDigilockerDocumentResult };

export async function beginClientDigilockerRedirect(
  clientUserId: string,
): Promise<BeginClientDigilockerResult> {
  const { redirect_url: redirectUrl, inline_complete: inlineComplete, identity_document_id: documentId } =
    await startClientKycDigilocker(clientUserId);
  if (inlineComplete) {
    if (!documentId?.trim()) {
      throw new Error("DigiLocker completed inline but identity document id is missing.");
    }
    const applied = await applyClientDigilockerIdentityDocument(clientUserId, documentId);
    if (!applied.success) {
      throw new Error(applied.reason || "DigiLocker fetch failed.");
    }
    return { outcome: "inline", applied };
  }
  if (!redirectUrl?.trim()) {
    throw new Error("DigiLocker redirect URL is missing.");
  }
  window.location.assign(redirectUrl);
  return { outcome: "redirect" };
}

export function readDigilockerReturnDocumentIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const documentId = params.get("identity_document");
  if (!documentId?.trim()) return null;
  if (params.get("status")) return documentId.trim();
  return null;
}

export function stripDigilockerReturnParamsFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.get("identity_document") && params.get("kyc_digilocker_return") !== "1") return;
  params.delete("identity_document");
  params.delete("status");
  params.delete("kyc_digilocker_return");
  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", next);
}
