import { apiRequest } from "@/lib/api-client";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { readReferralCode } from "@/features/referral/lib/referral-storage";
import { storeAuthResponse } from "@/features/auth/api/auth-response";
import type {
  AppleLoginProfile,
  AuthSuccessResponse,
  LoginFlowResponse,
  OtpSendResponse,
} from "@/features/auth/api/types";

export async function login(
  email: string,
  password: string,
  turnstileToken?: string | null
): Promise<LoginFlowResponse> {
  return apiRequest<LoginFlowResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      turnstile_token: turnstileToken ?? null,
      device_fingerprint: getDeviceFingerprint(),
    }),
  });
}

export async function loginWithGoogle(idToken: string): Promise<LoginFlowResponse> {
  return apiRequest<LoginFlowResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify({
      id_token: idToken,
      device_fingerprint: getDeviceFingerprint(),
      referral_code: readReferralCode(),
    }),
  });
}

export async function loginWithApple(
  idToken: string,
  profile?: AppleLoginProfile
): Promise<LoginFlowResponse> {
  return apiRequest<LoginFlowResponse>("/auth/apple", {
    method: "POST",
    body: JSON.stringify({
      id_token: idToken,
      device_fingerprint: getDeviceFingerprint(),
      user_email: profile?.userEmail ?? null,
      first_name: profile?.firstName ?? null,
      last_name: profile?.lastName ?? null,
      referral_code: readReferralCode(),
    }),
  });
}

export async function verifyMfaLogin(payload: {
  mfaToken: string;
  totpCode?: string;
  backupCode?: string;
}) {
  const data = await apiRequest<AuthSuccessResponse>("/auth/mfa/verify", {
    method: "POST",
    body: JSON.stringify({
      mfa_token: payload.mfaToken,
      totp_code: payload.totpCode ?? null,
      backup_code: payload.backupCode ?? null,
    }),
  });
  return storeAuthResponse(data);
}

export async function resendOAuthLinkOtp(linkToken: string) {
  return apiRequest<OtpSendResponse>("/auth/oauth/link/resend", {
    method: "POST",
    body: JSON.stringify({ link_token: linkToken }),
  });
}

export async function confirmOAuthLink(payload: {
  linkToken: string;
  emailOtp: string;
  password: string;
}) {
  const data = await apiRequest<LoginFlowResponse>("/auth/oauth/link/confirm", {
    method: "POST",
    body: JSON.stringify({
      link_token: payload.linkToken,
      email_otp: payload.emailOtp,
      password: payload.password,
      device_fingerprint: getDeviceFingerprint(),
    }),
  });
  if (data.next === "authenticated") {
    return storeAuthResponse(data);
  }
  return data;
}
