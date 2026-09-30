import { uploadDocument, waitForDocumentReady } from "@/features/documents/api/documents-api";
import type { DocumentType } from "@/features/documents/api/types";
import { createKycStubFile } from "@/features/documents/lib/kyc-document-stub";
import type { KycJourneyDraft } from "@/features/kyc/lib/kyc-journey-draft";

async function uploadKycStub(docType: DocumentType, filename: string) {
  const file = createKycStubFile(docType, filename);
  const uploaded = await uploadDocument(docType, file);
  return waitForDocumentReady(uploaded.id);
}

export async function submitKycJourneyDocuments(draft: KycJourneyDraft) {
  const uploads: Promise<unknown>[] = [];

  if (draft.pan?.panNumber) {
    uploads.push(uploadKycStub("pan", `pan-${draft.pan.panNumber}.png`));
  }
  if (draft.address) {
    uploads.push(uploadKycStub("address_proof", "address-proof.png"));
  }
  if (draft.bank) {
    uploads.push(uploadKycStub("bank_statement", `bank-${draft.bank.ifscCode}.png`));
  }
  if (draft.signature?.documentId) {
    // Signature already uploaded in the signature step.
  } else if (draft.signature?.dataUrl) {
    uploads.push(uploadKycStub("signature", "signature.png"));
  }
  if (draft.nominees?.length) {
    uploads.push(uploadKycStub("nominee_id", `nominee-${draft.nominees[0].id}.png`));
  }

  // DigiLocker flow represents verified Aadhaar retrieval.
  if (draft.pan?.panNumber) {
    uploads.push(uploadKycStub("aadhaar", `aadhaar-${draft.pan.panNumber}.png`));
  }

  await Promise.all(uploads);
}
