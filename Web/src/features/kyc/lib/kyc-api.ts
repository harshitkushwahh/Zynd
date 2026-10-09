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
  dateOfBirth?: string;
  panCategory?: string;
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
  nomination_opted_out?: boolean;
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
  poa_readiness_preverify_id: string | null;
  poa_pan_preverify_id: string | null;
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
  kyc_flow_mode?: KycFlowMode | null;
  requires_address_step_digilocker?: boolean | null;
  requires_address_step_proof_digilocker?: boolean | null;
  requires_pan_step_digilocker?: boolean | null;
  requires_digilocker?: boolean | null;
  poa_kyc_form_id?: string | null;
  proof_fetch_url?: string | null;
  requires_poa_proof_fetch?: boolean | null;
};

export type KycFlowMode = "repeat_kra" | "fresh_kyc" | "kra_update";

export type KycPoaFormStatus = {
  form_id: string | null;
  form_status: string | null;
  proof_details_status: string | null;
  proof_fetch_url: string | null;
  partner_fields_needed: string[] | null;
  needs_digilocker: boolean;
};

export type KycPanFailure = {
  field: "pan" | "name" | "date_of_birth" | string;
  status?: string;
  code?: string;
  reason?: string;
};

export type KycPanVerifyResponse = {
  success: boolean;
  blocked: boolean;
  block_type?: string;
  message?: string;
  failure?: KycPanFailure;
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

export async function verifyKycPan(body: {
  pan_number: string;
  full_name?: string;
  first_name: string;
  middle_name?: string;
  last_name?: string;
  date_of_birth: string;
}) {
  return apiRequest<KycPanVerifyResponse>("/kyc/pan/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type KycPanConfirmNamesResponse = {
  success: boolean;
  blocked: boolean;
  block_type?: string;
  failure?: KycPanFailure;
  pan_draft?: KycPanDraft;
  requires_digilocker?: boolean;
};

export async function confirmKycPanNames(body: {
  full_name?: string;
  first_name: string;
  middle_name?: string;
  last_name?: string;
}) {
  return apiRequest<KycPanConfirmNamesResponse>("/kyc/pan/confirm-names", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function resetKycJourneyDrafts() {
  return apiRequest<{ ok: boolean }>("/kyc/journey/reset-drafts", { method: "POST" });
}

export async function startKycDigilocker() {
  return apiRequest<{
    redirect_url: string;
    inline_complete?: boolean;
    identity_document_id?: string;
  }>("/kyc/kyc-request/start", {
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

export async function startPoaKycForm() {
  return apiRequest<KycPoaFormStatus>("/kyc/poa-form/start", { method: "POST" });
}

export async function fetchPoaKycFormStatus() {
  return apiRequest<KycPoaFormStatus>("/kyc/poa-form/status");
}

export async function syncPoaKycForm() {
  return apiRequest<{
    success: boolean;
    needs_digilocker: boolean;
    form_id?: string | null;
    proof_fetch_url?: string | null;
  requires_poa_proof_fetch?: boolean | null;
  }>("/kyc/poa-form/sync", { method: "POST" });
}

export async function retryPoaKycProof() {
  return apiRequest<KycPoaFormStatus>("/kyc/poa-form/retry-proof", { method: "POST" });
}

export async function saveKycJourneyState(body: {
  pan_draft_json?: Record<string, unknown>;
  contact_draft_json?: Record<string, unknown>;
  personal_draft_json?: Record<string, unknown>;
  nominee_draft_json?: Record<string, unknown>[];
  record_nomination_opt_out?: boolean;
  revoke_nomination_opt_out?: boolean;
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

export async function fetchKycIfsc(ifscCode: string) {
  return apiRequest<{
    ifsc_code: string;
    bank_name: string;
    branch: string;
    branch_name: string;
    city: string;
    district: string;
    state: string;
    branch_address: string;
  }>(`/kyc/master-data/ifsc/${encodeURIComponent(ifscCode.trim().toUpperCase())}`);
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
    readiness_verified?: boolean;
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

export async function checkKycReadiness(options?: { forceRefresh?: boolean }) {
  const query =
    options?.forceRefresh === true ? "?force_refresh=true" : "";
  return apiRequest<KycReadinessCheckResponse>(`/kyc/readiness/check${query}`, {
    method: "POST",
  });
}

export type InvestorSettingsStateResponse = {
  kyc_completed: boolean;
  has_investor_profile: boolean;
  investor_profile_id?: string | null;
  has_mf_investment_account: boolean;
  mfia_id?: string | null;
  can_edit_profile: boolean;
  can_add_nominee: boolean;
  nominee_count: number;
  max_nominees: number;
  nominees: Record<string, unknown>[];
};

export async function fetchInvestorSettingsState() {
  return apiRequest<InvestorSettingsStateResponse>("/kyc/settings/investor");
}

export async function updateInvestorProfileSettings(body: {
  income_slab?: string;
  pep_details?: string;
  marital_status?: string;
  spouse_name?: string;
}) {
  return apiRequest<InvestorSettingsStateResponse>("/kyc/settings/investor-profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function addInvestorNominee(nominee: object | object[]) {
  const nominees = Array.isArray(nominee) ? nominee : [nominee];
  return apiRequest<InvestorSettingsStateResponse>("/kyc/settings/nominees", {
    method: "POST",
    body: JSON.stringify({
      nominees,
      nominee: nominees[0] ?? null,
    }),
  });
}
