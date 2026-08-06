import { ApiError, apiRequest, getAccessToken } from "@/lib/api-client";
import { env } from "@/lib/env";

export type PartnerOnboardingStartResponse = {
  onboarding_token: string;
  retry_after_seconds: number;
  expires_in: number;
};

export type OtpSendResponse = {
  retry_after_seconds: number;
  expires_in: number;
};

export type PartnerOnboardingSubmitResponse = {
  partner_id: string;
  user_id: string;
  email: string;
  display_name: string;
  status: string;
};

export type DistributorPartnerListItem = {
  id: string;
  partner_id: string;
  user_id: string;
  client_id: string;
  name: string;
  email: string;
  arn: string;
  client_count: number;
  aum: number;
  status: string;
  onboarding_status: string;
  joined_at: string;
  profile_image_url?: string | null;
};

export type DistributorPartnerDetail = DistributorPartnerListItem & {
  mobile: string;
  mobile_masked: string;
  branch_id: string | null;
  branch_name: string;
  euin: string;
  pan_masked: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  active_sip_count: number;
  mtd_inflow: number;
  lumpsum_mtd: number;
  onboarding_complete_pct: number;
};

export type DistributorConsoleContext = {
  persona: string;
  client_id: string;
  branch: {
    id: string;
    name: string;
    city: string | null;
  } | null;
};

export type PartnerOnboardingProfilePhotoResponse = {
  uploaded: boolean;
  file_name: string;
};

export type PartnerOnboardingDraftSnapshot = {
  email: string | null;
  email_verified: boolean;
  mobile: string | null;
  mobile_verified: boolean;
  pan: string | null;
  pan_verified: boolean;
  pan_verified_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  bank_verified: boolean;
  bank: {
    account_holder_name?: string;
    account_number?: string;
    confirm_account_number?: string;
    account_type?: string;
    ifsc?: string;
    bank_name?: string;
    branch_name?: string;
    verification_mode?: string;
  } | null;
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  } | null;
  documents: {
    pan_file_name: string | null;
    aadhaar_file_name: string | null;
    pan_uploaded: boolean;
    aadhaar_uploaded: boolean;
  };
  profile_photo: {
    uploaded: boolean;
    file_name: string | null;
  };
};

async function fetchPartnerOnboardingAssetBlob(path: string, onboardingToken: string): Promise<Blob> {
  const response = await fetch(`${env.apiUrl}${path}?onboarding_token=${encodeURIComponent(onboardingToken)}`, {
    credentials: "include",
    headers: {
      ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
    },
  });
  if (!response.ok) {
    throw new ApiError("Could not load uploaded file.", "preview_failed", response.status);
  }
  return response.blob();
}

export async function fetchPartnerOnboardingDraft(onboardingToken: string) {
  return apiRequest<PartnerOnboardingDraftSnapshot>(
    `/distributor/partners/onboarding/draft?onboarding_token=${encodeURIComponent(onboardingToken)}`,
  );
}

export async function fetchPartnerOnboardingDocumentPreviewUrl(
  onboardingToken: string,
  docType: "pan" | "aadhaar",
): Promise<string> {
  const blob = await fetchPartnerOnboardingAssetBlob(
    `/distributor/partners/onboarding/documents/${docType}`,
    onboardingToken,
  );
  return URL.createObjectURL(blob);
}

export async function fetchPartnerOnboardingProfilePhotoPreviewUrl(
  onboardingToken: string,
): Promise<string> {
  const blob = await fetchPartnerOnboardingAssetBlob(
    "/distributor/partners/onboarding/profile-photo",
    onboardingToken,
  );
  return URL.createObjectURL(blob);
}

export async function startPartnerOnboarding(email: string) {
  return apiRequest<PartnerOnboardingStartResponse>("/distributor/partners/onboarding/start", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resendPartnerOnboardingEmailOtp(onboardingToken: string) {
  return apiRequest<OtpSendResponse>("/distributor/partners/onboarding/resend-email-otp", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken }),
  });
}

export async function verifyPartnerOnboardingEmail(onboardingToken: string, otp: string) {
  return apiRequest<{ verified: boolean }>("/distributor/partners/onboarding/verify-email", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken, otp }),
  });
}

export async function sendPartnerOnboardingMobileOtp(onboardingToken: string, mobile: string) {
  return apiRequest<OtpSendResponse>("/distributor/partners/onboarding/send-mobile-otp", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken, mobile }),
  });
}

export async function resendPartnerOnboardingMobileOtp(onboardingToken: string) {
  return apiRequest<OtpSendResponse>("/distributor/partners/onboarding/resend-mobile-otp", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken }),
  });
}

export async function verifyPartnerOnboardingMobile(onboardingToken: string, otp: string) {
  return apiRequest<{ verified: boolean }>("/distributor/partners/onboarding/verify-mobile", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken, otp }),
  });
}

export type PartnerOnboardingDraftPayload = {
  pan?: string;
  pan_verified_name?: string | null;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  bank?: {
    account_holder_name: string;
    account_number: string;
    confirm_account_number?: string;
    account_type?: string;
    ifsc: string;
    bank_name: string;
    branch_name?: string;
    verification_mode?: string;
  };
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  documents?: {
    pan_file_name: string | null;
    aadhaar_file_name: string | null;
  };
};

export async function updatePartnerOnboardingDraft(
  onboardingToken: string,
  payload: PartnerOnboardingDraftPayload,
) {
  return apiRequest<{ ok: boolean }>("/distributor/partners/onboarding/draft", {
    method: "PATCH",
    body: JSON.stringify({ onboarding_token: onboardingToken, ...payload }),
  });
}

export async function verifyPartnerOnboardingPan(onboardingToken: string, pan: string) {
  return apiRequest<{ verified: boolean; verified_name: string }>(
    "/distributor/partners/onboarding/verify-pan",
    {
      method: "POST",
      body: JSON.stringify({ onboarding_token: onboardingToken, pan }),
    },
  );
}

export async function verifyPartnerOnboardingBank(
  onboardingToken: string,
  payload: {
    account_number: string;
    account_type: string;
    ifsc: string;
  },
) {
  return apiRequest<{
    verified: boolean;
    verified_holder_name: string;
    bank_name: string;
    branch_name: string;
    account_type: string;
  }>("/distributor/partners/onboarding/verify-bank", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken, ...payload }),
  });
}

export async function verifyPartnerOnboardingBankManual(
  onboardingToken: string,
  payload: {
    account_holder_name: string;
    account_number: string;
    confirm_account_number: string;
    account_type: string;
    ifsc: string;
    bank_name: string;
    branch_name: string;
  },
) {
  return apiRequest<{
    verified: boolean;
    verified_holder_name: string;
    bank_name: string;
    branch_name: string;
    account_type: string;
    verification_mode: string;
  }>("/distributor/partners/onboarding/verify-bank-manual", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken, ...payload }),
  });
}

export async function uploadPartnerOnboardingDocument(
  onboardingToken: string,
  docType: "pan" | "aadhaar",
  file: File,
) {
  const formData = new FormData();
  formData.append("onboarding_token", onboardingToken);
  formData.append("file", file, file.name);
  return apiRequest<{ uploaded: boolean; file_name: string; doc_type: string }>(
    `/distributor/partners/onboarding/documents/${docType}`,
    {
      method: "POST",
      body: formData,
    },
  );
}

export async function clearPartnerOnboardingDocument(
  onboardingToken: string,
  docType: "pan" | "aadhaar",
) {
  return apiRequest<{ ok: boolean }>(`/distributor/partners/onboarding/documents/${docType}`, {
    method: "DELETE",
    body: JSON.stringify({ onboarding_token: onboardingToken }),
  });
}

export async function submitPartnerOnboarding(onboardingToken: string) {
  return apiRequest<PartnerOnboardingSubmitResponse>("/distributor/partners/onboarding/submit", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken }),
  });
}

export async function uploadPartnerOnboardingProfilePhoto(onboardingToken: string, file: File) {
  const formData = new FormData();
  formData.append("onboarding_token", onboardingToken);
  formData.append("file", file, file.name);
  return apiRequest<PartnerOnboardingProfilePhotoResponse>(
    "/distributor/partners/onboarding/profile-photo",
    {
      method: "POST",
      body: formData,
    },
  );
}

export async function clearPartnerOnboardingProfilePhoto(onboardingToken: string) {
  return apiRequest<{ ok: boolean }>("/distributor/partners/onboarding/profile-photo", {
    method: "DELETE",
    body: JSON.stringify({ onboarding_token: onboardingToken }),
  });
}

export async function fetchDistributorPartners() {
  return apiRequest<{ items: DistributorPartnerListItem[] }>("/distributor/partners");
}

export async function fetchDistributorPartnerDetail(reference: string) {
  return apiRequest<DistributorPartnerDetail>(
    `/distributor/partners/${encodeURIComponent(reference)}`,
  );
}

export async function fetchDistributorConsoleContext() {
  return apiRequest<DistributorConsoleContext>("/distributor/console/context");
}
