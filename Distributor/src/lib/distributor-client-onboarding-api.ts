import { apiRequest } from "@/lib/api-client";

export type ClientOnboardingStartResponse = {
  onboarding_token: string;
  retry_after_seconds: number;
  expires_in: number;
};

export type OtpSendResponse = {
  retry_after_seconds: number;
  expires_in: number;
};

export type ClientOnboardingSubmitResponse = {
  client_user_id: string;
  client_id: string;
  mitra_client_id: string;
  email: string;
  mobile: string;
};

export type ClientOnboardingDraftSnapshot = {
  email: string | null;
  email_verified: boolean;
  mobile: string | null;
  mobile_verified: boolean;
  ready_to_create: boolean;
};

export type ClientOnboardingContactUpdateResponse = OtpSendResponse & ClientOnboardingDraftSnapshot;

export type KycPanDraft = {
  panNumber: string;
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  panCategory: string;
  fullName?: string;
};

export type KycReadinessInfo = {
  status?: string;
  code?: string;
  reason?: string;
};

export type ClientKycPanVerifyResponse = {
  success: boolean;
  blocked: boolean;
  block_type?: string;
  message?: string;
  failure?: { field: string; code?: string; reason?: string };
  pan_draft?: KycPanDraft;
  kyc_already_registered?: boolean;
  readiness?: KycReadinessInfo;
  requires_digilocker?: boolean;
};

export type ClientKycPanConfirmNamesResponse = {
  success: boolean;
  blocked: boolean;
  block_type?: string;
  failure?: { field: string; code?: string; reason?: string };
  pan_draft?: KycPanDraft;
  requires_digilocker?: boolean;
};

export async function startClientOnboarding(email: string) {
  return apiRequest<ClientOnboardingStartResponse>("/distributor/clients/onboarding/start", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resendClientOnboardingEmailOtp(onboardingToken: string) {
  return apiRequest<OtpSendResponse>("/distributor/clients/onboarding/resend-email-otp", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken }),
  });
}

export async function verifyClientOnboardingEmail(onboardingToken: string, otp: string) {
  return apiRequest<{ verified: boolean }>("/distributor/clients/onboarding/verify-email", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken, otp }),
  });
}

export async function sendClientOnboardingMobileOtp(onboardingToken: string, mobile: string) {
  return apiRequest<OtpSendResponse>("/distributor/clients/onboarding/send-mobile-otp", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken, mobile }),
  });
}

export async function resendClientOnboardingMobileOtp(onboardingToken: string) {
  return apiRequest<OtpSendResponse>("/distributor/clients/onboarding/resend-mobile-otp", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken }),
  });
}

export async function verifyClientOnboardingMobile(onboardingToken: string, otp: string) {
  return apiRequest<{ verified: boolean }>("/distributor/clients/onboarding/verify-mobile", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken, otp }),
  });
}

export async function submitClientOnboarding(onboardingToken: string) {
  return apiRequest<ClientOnboardingSubmitResponse>("/distributor/clients/onboarding/submit", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken }),
  });
}

export async function fetchClientOnboardingDraft(onboardingToken: string) {
  return apiRequest<ClientOnboardingDraftSnapshot>(
    `/distributor/clients/onboarding/draft?onboarding_token=${encodeURIComponent(onboardingToken)}`,
  );
}

export async function updateClientOnboardingContact(
  onboardingToken: string,
  payload: { email?: string; mobile?: string },
) {
  return apiRequest<ClientOnboardingContactUpdateResponse>("/distributor/clients/onboarding/draft", {
    method: "PATCH",
    body: JSON.stringify({ onboarding_token: onboardingToken, ...payload }),
  });
}

export async function discardClientOnboardingDraft(onboardingToken: string) {
  return apiRequest<{ ok: boolean }>(
    `/distributor/clients/onboarding/draft?onboarding_token=${encodeURIComponent(onboardingToken)}`,
    { method: "DELETE" },
  );
}

export async function verifyClientKycPan(clientUserId: string, panNumber: string) {
  return apiRequest<ClientKycPanVerifyResponse>(
    `/distributor/clients/${encodeURIComponent(clientUserId)}/kyc/pan/verify`,
    {
      method: "POST",
      body: JSON.stringify({ pan_number: panNumber }),
    },
  );
}

export async function confirmClientKycPanNames(
  clientUserId: string,
  body: { first_name: string; middle_name: string; last_name: string },
) {
  return apiRequest<ClientKycPanConfirmNamesResponse>(
    `/distributor/clients/${encodeURIComponent(clientUserId)}/kyc/pan/confirm-names`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export type ClientKycBootstrapResponse = {
  eligible: boolean;
  reasons: string[];
  last_completed_step: string | null;
  active_step_index: number;
  pan_draft: Record<string, unknown> | null;
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
  geolocation_draft: Record<string, unknown> | null;
  client_id?: string | null;
};

export async function fetchClientKycBootstrap(clientUserId: string) {
  return apiRequest<ClientKycBootstrapResponse>(
    `/distributor/clients/${encodeURIComponent(clientUserId)}/kyc/bootstrap`,
  );
}

export type PoaFieldStatus = {
  status?: string | null;
  code?: string | null;
  reason?: string | null;
};

export type ClientKycBankVerifyResponse = {
  success: boolean;
  account_holder_name?: string;
  pan_holder_name?: string;
  kyckart_account_holder_name?: string;
  kyckart_lookup_error?: string;
  bank_name?: string;
  branch?: string;
  pan_verified: boolean;
  bank_verified: boolean;
  readiness_verified: boolean;
  requires_manual_verification: boolean;
  requires_proof_upload: boolean;
  preverify_id?: string;
  failure?: { field: string; code?: string; reason?: string };
  poa_pan_status?: PoaFieldStatus;
  poa_bank_status?: PoaFieldStatus;
  poa_readiness_status?: PoaFieldStatus;
};

export async function verifyClientKycBankHybrid(
  clientUserId: string,
  body: { account_number: string; account_type: string; ifsc_code: string },
) {
  return apiRequest<ClientKycBankVerifyResponse>(
    `/distributor/clients/${encodeURIComponent(clientUserId)}/kyc/bank/verify-hybrid`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function fetchClientKycBankPreverifyStatus(
  clientUserId: string,
  preverifyId: string,
) {
  return apiRequest<{
    status?: string;
    bank_verified: boolean;
    pan_verified?: boolean;
    readiness_verified?: boolean;
    code?: string;
    reason?: string;
    poa_pan_status?: PoaFieldStatus;
    poa_bank_status?: PoaFieldStatus;
    poa_readiness_status?: PoaFieldStatus;
  }>(
    `/distributor/clients/${encodeURIComponent(clientUserId)}/kyc/bank/preverify/${encodeURIComponent(preverifyId)}`,
  );
}

export type ClientKycJourneyStateResponse = {
  success: boolean;
  last_completed_step: string | null;
  active_step_index: number;
};

export async function saveClientKycJourneyState(
  clientUserId: string,
  body: {
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
  },
) {
  return apiRequest<ClientKycJourneyStateResponse>(
    `/distributor/clients/${encodeURIComponent(clientUserId)}/kyc/journey/state`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export type ClientKycSubmitResponse = {
  form_id?: string | null;
  form_status?: string | null;
  next_action: string;
  redirect_url?: string | null;
  message?: string | null;
  signature_provided: boolean;
  proof_status?: string | null;
  esign_status?: string | null;
  failure_reason?: string | null;
};

export async function submitClientKyc(
  clientUserId: string,
  body?: { latitude?: number; longitude?: number; accuracy_meters?: number },
) {
  return apiRequest<ClientKycSubmitResponse>(
    `/distributor/clients/${encodeURIComponent(clientUserId)}/kyc/submit`,
    {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    },
  );
}
