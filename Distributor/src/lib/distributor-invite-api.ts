import { apiRequest, setAccessToken } from "@/lib/api-client";
import {
  DISTRIBUTOR_DEVICE_FINGERPRINT,
  type DistributorBackendUser,
} from "@/lib/distributor-auth-api";

export type DistributorInvitePreview = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_key: string;
  role_name: string | null;
  inviter_name: string | null;
  expires_at: string;
  target_console: "admin" | "distributor";
};

type AuthSuccessResponse = {
  next: "authenticated";
  access_token: string;
  user: DistributorBackendUser;
};

export async function validateDistributorInvite(token: string) {
  const params = new URLSearchParams({ token });
  return apiRequest<DistributorInvitePreview>(`/auth/admin-invite/validate?${params.toString()}`);
}

export async function acceptDistributorInvite(payload: {
  token: string;
  first_name: string;
  last_name?: string;
  password: string;
}) {
  return apiRequest<{
    next: "onboarding";
    onboarding_token: string;
    expires_in: number;
  }>("/auth/admin-invite/accept", {
    method: "POST",
    body: JSON.stringify({
      token: payload.token,
      first_name: payload.first_name,
      last_name: payload.last_name ?? null,
      password: payload.password,
      device_fingerprint: DISTRIBUTOR_DEVICE_FINGERPRINT,
    }),
  });
}

export async function distributorInviteMfaStart(onboardingToken: string) {
  return apiRequest<{
    enroll_token: string;
    qr_uri: string;
    manual_secret: string;
    expires_in: number;
  }>("/auth/admin-invite/mfa/start", {
    method: "POST",
    body: JSON.stringify({ onboarding_token: onboardingToken }),
  });
}

export async function distributorInviteMfaConfirm(
  onboardingToken: string,
  enrollToken: string,
  totpCode: string,
) {
  return apiRequest<{
    enrolled: boolean;
    backup_codes: string[];
  }>("/auth/admin-invite/mfa/confirm", {
    method: "POST",
    body: JSON.stringify({
      onboarding_token: onboardingToken,
      enroll_token: enrollToken,
      totp_code: totpCode,
    }),
  });
}

export async function completeDistributorInvite(payload: {
  onboardingToken: string;
  pin: string;
  confirmPin: string;
  totpCode: string;
}) {
  const result = await apiRequest<AuthSuccessResponse>("/auth/admin-invite/complete", {
    method: "POST",
    body: JSON.stringify({
      onboarding_token: payload.onboardingToken,
      pin: payload.pin,
      confirm_pin: payload.confirmPin,
      totp_code: payload.totpCode,
      device_fingerprint: DISTRIBUTOR_DEVICE_FINGERPRINT,
    }),
  });
  setAccessToken(result.access_token);
  return result;
}
