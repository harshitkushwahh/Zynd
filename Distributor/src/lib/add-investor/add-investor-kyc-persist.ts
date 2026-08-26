import type {
  AddInvestorAddressDraft,
  AddInvestorBankDraft,
  AddInvestorPersonalDraft,
} from "@/lib/add-investor/add-investor-journey";
import type { AddInvestorNomineeRecord } from "@/lib/add-investor/add-investor-nominee";
import type { AddInvestorSignatureTab } from "@/lib/add-investor/add-investor-signature";
import { saveClientKycJourneyState } from "@/lib/distributor-client-onboarding-api";

function mapContactDraft(address: AddInvestorAddressDraft): Record<string, unknown> {
  return {
    permanent: address.permanent,
    correspondence: address.correspondenceSame
      ? address.permanent
      : address.correspondence,
    sameAsPermanent: address.correspondenceSame,
  };
}

function mapPersonalDraft(personal: AddInvestorPersonalDraft): Record<string, unknown> {
  return {
    fathersName: personal.fathersName,
    gender: personal.gender,
    maritalStatus: personal.maritalStatus,
    occupation: personal.occupation,
    incomeSlab: personal.incomeSlab,
    pepExposed: personal.pepExposed,
    placeOfBirth: personal.placeOfBirth,
    countryOfOrigin: personal.countryOfOrigin,
  };
}

function ageToDateOfBirth(age: string): string {
  const years = Number.parseInt(age.trim(), 10);
  if (!Number.isFinite(years) || years <= 0) return "";
  const year = new Date().getFullYear() - years;
  return `${year}-01-01`;
}

function mapNomineeDraft(nominees: AddInvestorNomineeRecord[]): Record<string, unknown>[] {
  return nominees.map((nominee) => ({
    id: nominee.id,
    type: nominee.type,
    core: {
      ...nominee.core,
      dateOfBirth: ageToDateOfBirth(nominee.core.age),
    },
    contact: nominee.contact,
    identity: nominee.identity,
    address: nominee.address,
    guardian: nominee.guardian,
  }));
}

function mapBankDraft(bank: AddInvestorBankDraft): Record<string, unknown> {
  return {
    accountNumber: bank.accountNumber,
    accountType: bank.accountType,
    ifscCode: bank.ifsc,
    accountHolderName: bank.accountHolderName,
    bankName: bank.bankName,
    branch: bank.branchName,
    verificationStatus: bank.accountVerified ? "verified" : "pending",
  };
}

function mapSignatureDraft(
  signatureDataUrl: string,
  signatureMode: AddInvestorSignatureTab | null,
): Record<string, unknown> | null {
  if (!signatureDataUrl.trim()) return null;
  return {
    dataUrl: signatureDataUrl,
    mode: signatureMode ?? "upload",
  };
}

export async function persistAddInvestorKycBeforeSubmit(input: {
  clientUserId: string;
  address: AddInvestorAddressDraft;
  personal: AddInvestorPersonalDraft;
  nominees: AddInvestorNomineeRecord[];
  bank: AddInvestorBankDraft;
  signatureDataUrl: string;
  signatureMode: AddInvestorSignatureTab | null;
  requiresDigilocker: boolean;
}): Promise<void> {
  const { clientUserId } = input;

  await saveClientKycJourneyState(clientUserId, {
    contact_draft_json: mapContactDraft(input.address),
    last_completed_step: "address",
  });

  await saveClientKycJourneyState(clientUserId, {
    personal_draft_json: mapPersonalDraft(input.personal),
    last_completed_step: "personal",
  });

  await saveClientKycJourneyState(clientUserId, {
    nominee_draft_json: mapNomineeDraft(input.nominees),
    last_completed_step: "nominee",
  });

  await saveClientKycJourneyState(clientUserId, {
    bank_draft_json: mapBankDraft(input.bank),
    last_completed_step: "bank",
  });

  const signatureDraft = mapSignatureDraft(input.signatureDataUrl, input.signatureMode);
  if (input.requiresDigilocker && signatureDraft) {
    await saveClientKycJourneyState(clientUserId, {
      signature_draft_json: signatureDraft,
      last_completed_step: "signature",
    });
  }

  await saveClientKycJourneyState(clientUserId, {
    last_completed_step: "review",
  });
}
