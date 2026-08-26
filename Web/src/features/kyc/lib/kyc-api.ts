import { apiRequest, getAccessToken } from "@/lib/api-client";
import { env } from "@/lib/env";

export type KycEligibilityReason =
  | "account_inactive"
  | "email_not_verified"
  | "phone_not_verified"
  | "mfa_required"
  | "pin_required";

export type KycPanDraft = {
  panNumber?: string;
  panMasked?: string;
  panLast4?: string;
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  panCategory: string;
  fullName?: string;
};

export type KycStepStatuses = {
  pan: string;
  digilocker: string;
  address: string;
  personal: string;
  nominee: string;
  bank: string;
  signature: string;
  review: string;
  overall: string;
};

export type KycBootstrapResponse = {
  eligible: boolean;
  reasons: KycEligibilityReason[];
  last_completed_step: string | null;
  active_step_index: number;
  pan_draft: KycPanDraft | null;
  contact_draft: Record<string, unknown> | null;
  personal_draft: Record<string, unknown> | null;
  nominee_draft: Record<string, unknown>[] | null;
  bank_draft: Record<string, unknown> | null;
  kyc_already_registered: boolean | null;
  readiness_code: string | null;
  readiness_reason: string | null;
  pan_verification_status: string | null;
  pan_verification_failure: { field: string; code?: string; reason?: string } | null;
  external_identity_document_id: string | null;
  external_kyc_status: string | null;
  digilocker_failure_reason: string | null;
  bank_verification_status: string | null;
  bank_verification_failure: { field: string; code?: string; reason?: string } | null;
  poa_bank_preverify_id: string | null;
  poa_bank_proof_file_id: string | null;
  signature_draft: Record<string, unknown> | null;
  external_kyc_form_id: string | null;
  kyc_form_status: string | null;
  kyc_form_type: string | null;
  kyc_form_failure_reason: string | null;
  proof_details_status: string | null;
  esign_details_status: string | null;
  geolocation_draft: {
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
  } | null;
  step_statuses?: KycStepStatuses | null;
};

export type KycPanVerifyResponse = {
  success: boolean;
  blocked: boolean;
  block_type?: string;
  message?: string;
  failure?: { field: string; code?: string; reason?: string };
  pan_draft?: KycPanDraft;
  kyc_already_registered?: boolean;
  readiness?: { status?: string; code?: string; reason?: string };
  requires_digilocker?: boolean;
};

export type KycMasterDataOption = { label: string; value: string };

export type KycMasterDataEnums = {
  gender: KycMasterDataOption[];
  marital_status: KycMasterDataOption[];
  occupation: KycMasterDataOption[];
  income_slab: KycMasterDataOption[];
  pep_exposed: KycMasterDataOption[];
};

export type KycNomineeEnums = {
  relationships: KycMasterDataOption[];
  source_of_wealth: KycMasterDataOption[];
  document_types: KycMasterDataOption[];
};

export type KycFormActionResponse = {
  form_id: string | null;
  form_status: string | null;
  next_action:
    | "none"
    | "ready"
    | "proof_redirect"
    | "esign_redirect"
    | "processing"
    | "submitted"
    | "completed"
    | "failed";
  redirect_url?: string | null;
  message?: string | null;
  signature_provided?: boolean;
  proof_status?: string | null;
  esign_status?: string | null;
  failure_reason?: string | null;
};

export type KycBankVerifyResponse = {
  success: boolean;
  account_holder_name?: string;
  bank_name?: string;
  branch?: string;
  pan_verified: boolean;
  bank_verified: boolean;
  readiness_verified: boolean;
  requires_manual_verification: boolean;
  requires_proof_upload: boolean;
  preverify_id?: string;
  failure?: { field: string; code?: string; reason?: string };
};

export async function ensureKycToken() {
  return apiRequest<{ ok: boolean }>("/kyc/token/ensure", { method: "POST" });
}

export async function fetchKycBootstrap() {
  return apiRequest<KycBootstrapResponse>("/kyc/journey/bootstrap");
}

export async function verifyKycPan(panNumber: string) {
  return apiRequest<KycPanVerifyResponse>("/kyc/pan/verify", {
    method: "POST",
    body: JSON.stringify({ pan_number: panNumber }),
  });
}

export type KycPanConfirmNamesResponse = {
  success: boolean;
  blocked: boolean;
  block_type?: string;
  failure?: { field: string; code?: string; reason?: string };
  pan_draft?: KycPanDraft;
};

export async function confirmKycPanNames(body: {
  first_name: string;
  middle_name: string;
  last_name: string;
}) {
  return apiRequest<KycPanConfirmNamesResponse>("/kyc/pan/confirm-names", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function startKycDigilocker() {
  return apiRequest<{ redirect_url: string }>("/kyc/kyc-request/start", {
    method: "POST",
  });
}

export async function fetchKycIdentityDocument(documentId: string) {
  return apiRequest<{
    success: boolean;
    fetch_status?: string;
    reason?: string;
    aadhaar_not_selected?: boolean;
    contact_draft?: Record<string, unknown>;
    personal_draft?: Record<string, unknown>;
  }>(`/kyc/identity-document/${encodeURIComponent(documentId)}`);
}

export async function saveKycJourneyState(body: {
  pan_draft_json?: Record<string, unknown>;
  contact_draft_json?: Record<string, unknown>;
  personal_draft_json?: Record<string, unknown>;
  nominee_draft_json?: Record<string, unknown>[];
  bank_draft_json?: Record<string, unknown>;
  signature_draft_json?: Record<string, unknown>;
  geolocation_json?: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
  };
  last_completed_step?:
    | "pan"
    | "digilocker"
    | "address"
    | "personal"
    | "nominee"
    | "bank"
    | "signature"
    | "review";
  middle_name?: string;
}) {
  return apiRequest<{ success: boolean; last_completed_step: string | null; active_step_index: number }>(
    "/kyc/journey/state",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function saveKycGeolocation(coords: {
  latitude: number;
  longitude: number;
  accuracy: number;
}) {
  return saveKycJourneyState({
    geolocation_json: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyMeters: coords.accuracy,
    },
  });
}

export async function fetchKycMasterDataEnums() {
  return apiRequest<KycMasterDataEnums>("/kyc/master-data/enums");
}

export async function fetchKycNomineeEnums() {
  return apiRequest<KycNomineeEnums>("/kyc/master-data/nominee-enums");
}

export async function fetchKycStates() {
  return apiRequest<Array<{ name: string; state_code: string; country_ansi_code: string }>>(
    "/kyc/master-data/states",
  );
}

export async function fetchKycCountries() {
  return apiRequest<Array<{ name: string; ansi_code: string }>>("/kyc/master-data/countries");
}

export async function fetchKycPincode(pincode: string) {
  return apiRequest<{
    code: string;
    city: string;
    district: string;
    state_name: string;
    country_ansi_code: string;
  }>(`/kyc/master-data/pincode/${encodeURIComponent(pincode)}`);
}

export async function verifyKycBankHybrid(body: {
  account_number: string;
  account_type: string;
  ifsc_code: string;
}) {
  return apiRequest<KycBankVerifyResponse>("/kyc/bank/verify-hybrid", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function uploadKycBankProof(file: File) {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${env.apiUrl}/kyc/bank/upload-proof`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.detail?.message ?? payload?.message ?? "Could not upload bank proof.");
  }

  return response.json() as Promise<{ file_id: string }>;
}

export async function verifyKycBankManual() {
  return apiRequest<{
    success: boolean;
    bank_verified: boolean;
    requires_manual_verification: boolean;
    requires_proof_upload: boolean;
    failure?: { field: string; code?: string; reason?: string };
  }>("/kyc/bank/verify-manual", { method: "POST" });
}

export async function submitKycForm(body?: {
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
}) {
  return apiRequest<KycFormActionResponse>("/kyc/form/submit", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function continueKycForm() {
  return apiRequest<KycFormActionResponse>("/kyc/form/continue", { method: "POST" });
}

export async function fetchKycFormStatus() {
  return apiRequest<KycFormActionResponse & { kra_verified?: boolean }>("/kyc/form/status");
}

export async function fetchKycBankPreverifyStatus(preverifyId: string) {
  return apiRequest<{
    status?: string;
    bank_verified: boolean;
    code?: string;
    reason?: string;
  }>(`/kyc/bank/preverify/${encodeURIComponent(preverifyId)}`);
}

export type KycReadinessCheckResponse = {
  kra_verified: boolean;
  overall_status: string;
  readiness: { status?: string; code?: string; reason?: string };
  message: string;
  nameUpdated?: boolean;
};

export async function checkKycReadiness() {
  return apiRequest<KycReadinessCheckResponse>("/kyc/readiness/check", { method: "POST" });
}
