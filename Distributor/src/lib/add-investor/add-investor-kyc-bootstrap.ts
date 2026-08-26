import {
  addInvestorStepIndex,
  buildAddInvestorJourneySteps,
  emptyAddressDraft,
  emptyBankDraft,
  emptyPersonalDraft,
  normalizeAddInvestorPersonalDraft,
  type AddInvestorAddressDraft,
  type AddInvestorAddressFields,
  type AddInvestorBankDraft,
  type AddInvestorJourneyStep,
  type AddInvestorPanName,
  type AddInvestorPersonalDraft,
  type AddInvestorReadiness,
  type AddInvestorStepId,
} from "@/lib/add-investor/add-investor-journey";
import { mapPanVerifyToInvestorReadiness } from "@/lib/add-investor/add-investor-pan-readiness";
import type { AddInvestorNomineeRecord } from "@/lib/add-investor/add-investor-nominee";
import type { AddInvestorSignatureTab } from "@/lib/add-investor/add-investor-signature";
import type { ClientKycBootstrapResponse } from "@/lib/distributor-client-onboarding-api";

export type AddInvestorComplianceSnapshot = {
  panVerified: boolean;
  middleName: string;
  panName: AddInvestorPanName | null;
  readiness: AddInvestorReadiness | null;
  requiresDigilocker: boolean | null;
  digilockerDone: boolean;
  address: AddInvestorAddressDraft;
  addressFromDigilocker: boolean;
  personal: AddInvestorPersonalDraft;
  signatureDataUrl: string;
  signatureMode: AddInvestorSignatureTab | null;
  nominees: AddInvestorNomineeRecord[];
  bank: AddInvestorBankDraft;
  esignDone: boolean;
  maxReachedStepIndex: number;
};

export type AddInvestorComplianceHydration = Partial<AddInvestorComplianceSnapshot> & {
  pan?: string;
  stepId?: AddInvestorStepId;
};

const REKYC_READINESS_CODES = new Set(["kyc_incomplete", "kyc_legacy", "kyc_onhold", "kyc_rejected"]);

function mapAddressFields(raw: Record<string, unknown> | undefined): AddInvestorAddressFields {
  return {
    line1: String(raw?.line1 ?? raw?.line_1 ?? ""),
    line2: String(raw?.line2 ?? raw?.line_2 ?? ""),
    city: String(raw?.city ?? ""),
    state: String(raw?.state ?? raw?.state_name ?? ""),
    pincode: String(raw?.pincode ?? ""),
    country: String(raw?.country ?? "India"),
  };
}

export function mapBootstrapAddressDraft(
  raw: Record<string, unknown> | null | undefined,
): AddInvestorAddressDraft | null {
  if (!raw) return null;
  const permanentRaw = (raw.permanent as Record<string, unknown> | undefined) ?? raw;
  const permanent = mapAddressFields(permanentRaw);
  if (!permanent.line1.trim() && !permanent.city.trim() && !permanent.pincode.trim()) {
    return null;
  }
  const correspondenceRaw = raw.correspondence as Record<string, unknown> | undefined;
  const correspondenceSame = Boolean(raw.sameAsPermanent ?? raw.correspondenceSame ?? true);
  const correspondence = correspondenceRaw ? mapAddressFields(correspondenceRaw) : permanent;
  return {
    permanent,
    correspondence: correspondenceSame ? permanent : correspondence,
    correspondenceSame,
  };
}

export function mapBootstrapPersonalDraft(
  raw: Record<string, unknown> | null | undefined,
): AddInvestorPersonalDraft | null {
  if (!raw) return null;
  return normalizeAddInvestorPersonalDraft({
    fathersName: String(raw.fathersName ?? raw.father_name ?? ""),
    gender: String(raw.gender ?? ""),
    maritalStatus: String(raw.maritalStatus ?? raw.marital_status ?? ""),
    occupation: String(raw.occupation ?? ""),
    incomeSlab: String(raw.incomeSlab ?? raw.income_slab ?? ""),
    pepExposed: String(raw.pepExposed ?? raw.pep_exposed ?? "not_applicable"),
    placeOfBirth: String(raw.placeOfBirth ?? raw.place_of_birth ?? ""),
    countryOfOrigin: String(raw.countryOfOrigin ?? raw.country_of_origin ?? ""),
  });
}

export function mapBootstrapBankDraft(
  raw: Record<string, unknown> | null | undefined,
  bankVerificationStatus?: string | null,
): AddInvestorBankDraft | null {
  if (!raw) return null;
  const accountNumber = String(raw.accountNumber ?? raw.account_number ?? "");
  const ifsc = String(raw.ifscCode ?? raw.ifsc_code ?? "").toUpperCase();
  const bankName = String(raw.bankName ?? raw.bank_name ?? "");
  if (!accountNumber.trim() && !ifsc.trim()) return null;
  const verified =
    bankVerificationStatus === "verified" ||
    String(raw.verificationStatus ?? raw.verification_status ?? "") === "verified";
  return {
    accountHolderName: String(raw.accountHolderName ?? raw.account_holder_name ?? ""),
    bankName,
    branchName: String(raw.branch ?? raw.branchName ?? raw.branch_name ?? ""),
    accountNumber,
    accountType: String(raw.accountType ?? raw.account_type ?? ""),
    ifsc,
    accountVerified: verified || Boolean(bankName.trim() && raw.accountHolderName),
  };
}

export function mapBootstrapPanDraft(
  raw: Record<string, unknown> | null | undefined,
): { pan: string; panName: AddInvestorPanName | null; middleName: string } {
  if (!raw) {
    return { pan: "", panName: null, middleName: "" };
  }
  const fullName = String(raw.fullName ?? raw.full_name ?? "").trim();
  const firstName = String(raw.firstName ?? raw.first_name ?? "").trim();
  let lastName = String(raw.lastName ?? raw.last_name ?? "").trim();
  const singleNameOnly = Boolean(
    raw.singleNameOnly
      ?? (fullName.split(/\s+/).filter(Boolean).length === 1
        || (firstName && lastName && firstName.toUpperCase() === lastName.toUpperCase())),
  );
  if (singleNameOnly) {
    lastName = "";
  }
  const panName: AddInvestorPanName = {
    firstName,
    lastName,
    dateOfBirth: String(raw.dateOfBirth ?? raw.date_of_birth ?? ""),
    panCategory: String(raw.panCategory ?? raw.pan_category ?? ""),
    singleNameOnly,
  };
  const hasName = Boolean(panName.firstName.trim() && (panName.lastName.trim() || singleNameOnly));
  return {
    pan: String(raw.panNumber ?? raw.pan_number ?? "").toUpperCase(),
    panName: hasName ? panName : null,
    middleName: String(raw.middleName ?? raw.middle_name ?? ""),
  };
}

export function resolveRequiresDigilockerFromBootstrap(
  bootstrap: ClientKycBootstrapResponse,
): boolean | null {
  if (bootstrap.kyc_already_registered === true) return false;
  if (bootstrap.kyc_already_registered === false) return true;
  const code = (bootstrap.readiness_code ?? "").toLowerCase();
  if (code === "kyc_incomplete") return true;
  if (REKYC_READINESS_CODES.has(code)) return false;
  if (bootstrap.pan_verification_status === "verified") return true;
  return null;
}

export function hydrationFromClientKycBootstrap(
  bootstrap: ClientKycBootstrapResponse,
): AddInvestorComplianceHydration {
  const panVerified = bootstrap.pan_verification_status === "verified";
  const panFields = mapBootstrapPanDraft(bootstrap.pan_draft ?? null);
  const requiresDigilocker = resolveRequiresDigilockerFromBootstrap(bootstrap);
  const readiness = mapPanVerifyToInvestorReadiness({
    kycAlreadyRegistered: bootstrap.kyc_already_registered ?? undefined,
    readiness: bootstrap.readiness_code
      ? { code: bootstrap.readiness_code, reason: bootstrap.readiness_reason ?? undefined }
      : null,
  });

  const address = mapBootstrapAddressDraft(bootstrap.contact_draft ?? null);
  const personal = mapBootstrapPersonalDraft(bootstrap.personal_draft ?? null);
  const bank = mapBootstrapBankDraft(
    bootstrap.bank_draft ?? null,
    bootstrap.bank_verification_status,
  );
  const digilockerDone = bootstrap.external_kyc_status === "returned_success";
  const signatureDraft = bootstrap.signature_draft;
  const signatureDataUrl = signatureDraft
    ? String(signatureDraft.dataUrl ?? signatureDraft.data_url ?? "")
    : "";

  return {
    pan: panFields.pan,
    panVerified,
    panName: panFields.panName,
    middleName: panFields.middleName,
    readiness: panVerified ? readiness : null,
    requiresDigilocker,
    digilockerDone,
    address: address ?? undefined,
    addressFromDigilocker: digilockerDone && Boolean(address),
    personal: personal ?? undefined,
    bank: bank ?? undefined,
    signatureDataUrl: signatureDataUrl || undefined,
    signatureMode: signatureDataUrl ? ("upload" as AddInvestorSignatureTab) : undefined,
    esignDone: bootstrap.esign_details_status === "completed",
  };
}

export function mergeComplianceHydration(
  local: AddInvestorComplianceHydration | null | undefined,
  remote: AddInvestorComplianceHydration,
): AddInvestorComplianceHydration {
  return {
    ...local,
    ...remote,
    pan: remote.pan || local?.pan,
    panVerified: remote.panVerified ?? local?.panVerified ?? false,
    panName: remote.panName ?? local?.panName ?? null,
    middleName: remote.middleName ?? local?.middleName ?? "",
    readiness: remote.readiness ?? local?.readiness ?? null,
    requiresDigilocker:
      remote.requiresDigilocker ?? local?.requiresDigilocker ?? null,
    digilockerDone: remote.digilockerDone ?? local?.digilockerDone ?? false,
    address: remote.address ?? local?.address,
    addressFromDigilocker:
      remote.addressFromDigilocker ?? local?.addressFromDigilocker ?? false,
    personal: remote.personal ?? local?.personal,
    bank: remote.bank ?? local?.bank,
    signatureDataUrl: remote.signatureDataUrl ?? local?.signatureDataUrl,
    signatureMode: remote.signatureMode ?? local?.signatureMode,
    nominees: local?.nominees?.length ? local.nominees : remote.nominees,
    esignDone: remote.esignDone ?? local?.esignDone ?? false,
    maxReachedStepIndex: Math.max(
      local?.maxReachedStepIndex ?? 0,
      remote.maxReachedStepIndex ?? 0,
    ),
  };
}

export function snapshotFromComplianceHydration(
  hydration: AddInvestorComplianceHydration,
  fallback: {
    address: AddInvestorAddressDraft;
    personal: AddInvestorPersonalDraft;
    bank: AddInvestorBankDraft;
    nominees: AddInvestorNomineeRecord[];
    signatureDataUrl: string;
    signatureMode: AddInvestorSignatureTab | null;
    maxReachedStepIndex: number;
  },
): AddInvestorComplianceSnapshot {
  return {
    panVerified: hydration.panVerified ?? false,
    middleName: hydration.middleName ?? "",
    panName: hydration.panName ?? null,
    readiness: hydration.readiness ?? null,
    requiresDigilocker: hydration.requiresDigilocker ?? null,
    digilockerDone: hydration.digilockerDone ?? false,
    address: hydration.address ?? fallback.address,
    addressFromDigilocker: hydration.addressFromDigilocker ?? false,
    personal: hydration.personal ?? fallback.personal,
    signatureDataUrl: hydration.signatureDataUrl ?? fallback.signatureDataUrl,
    signatureMode: hydration.signatureMode ?? fallback.signatureMode,
    nominees: hydration.nominees ?? fallback.nominees,
    bank: hydration.bank ?? fallback.bank,
    esignDone: hydration.esignDone ?? false,
    maxReachedStepIndex: hydration.maxReachedStepIndex ?? fallback.maxReachedStepIndex,
  };
}

export function hydrationFromComplianceSnapshot(
  snapshot: AddInvestorComplianceSnapshot,
): AddInvestorComplianceHydration {
  return {
    panVerified: snapshot.panVerified,
    middleName: snapshot.middleName,
    panName: snapshot.panName,
    readiness: snapshot.readiness,
    requiresDigilocker: snapshot.requiresDigilocker,
    digilockerDone: snapshot.digilockerDone,
    address: snapshot.address,
    addressFromDigilocker: snapshot.addressFromDigilocker,
    personal: snapshot.personal,
    signatureDataUrl: snapshot.signatureDataUrl,
    signatureMode: snapshot.signatureMode,
    nominees: snapshot.nominees,
    bank: snapshot.bank,
    esignDone: snapshot.esignDone,
    maxReachedStepIndex: snapshot.maxReachedStepIndex,
  };
}

export function resolveResumeStepId(
  steps: AddInvestorJourneyStep[],
  preferred: AddInvestorStepId,
  hydration: AddInvestorComplianceHydration,
): AddInvestorStepId {
  if (addInvestorStepIndex(steps, preferred) >= 0) {
    return preferred;
  }
  if (hydration.panVerified) {
    for (const candidate of ["address", "personal-info", "nominee", "bank", "review"] as const) {
      if (addInvestorStepIndex(steps, candidate) >= 0) {
        return candidate;
      }
    }
  }
  return "pan";
}

export function emptyComplianceSnapshot(): AddInvestorComplianceSnapshot {
  return {
    panVerified: false,
    middleName: "",
    panName: null,
    readiness: null,
    requiresDigilocker: null,
    digilockerDone: false,
    address: emptyAddressDraft(),
    addressFromDigilocker: false,
    personal: emptyPersonalDraft(),
    signatureDataUrl: "",
    signatureMode: null,
    nominees: [],
    bank: emptyBankDraft(),
    esignDone: false,
    maxReachedStepIndex: 0,
  };
}
