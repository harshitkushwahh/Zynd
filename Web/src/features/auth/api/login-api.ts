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

function persistIfAuthenticated(result: LoginFlowResponse) {
  if (result.next === "authenticated") {
    return storeAuthResponse(result);
  }
  return result;
}

export async function login(
  email: string,
  password: string,
  turnstileToken?: string | null
): Promise<LoginFlowResponse> {
  const result = await apiRequest<LoginFlowResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      turnstile_token: turnstileToken ?? null,
      device_fingerprint: getDeviceFingerprint(),
    }),
  });
  return persistIfAuthenticated(result);
}

export async function loginWithGoogle(idToken: string): Promise<LoginFlowResponse> {
  const result = await apiRequest<LoginFlowResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify({
      id_token: idToken,
      device_fingerprint: getDeviceFingerprint(),
      referral_code: readReferralCode(),
    }),
  });
  return persistIfAuthenticated(result);
}

export async function loginWithApple(
  idToken: string,
  profile?: AppleLoginProfile
): Promise<LoginFlowResponse> {
  const result = await apiRequest<LoginFlowResponse>("/auth/apple", {
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
  return persistIfAuthenticated(result);
}

export async function verifyMfaLogin(payload: {
  mfaToken: string;
  totpCode?: string;
  backupCode?: string;
  smsOtp?: string;
}) {
  const data = await apiRequest<AuthSuccessResponse>("/auth/mfa/verify", {
    method: "POST",
    body: JSON.stringify({
      mfa_token: payload.mfaToken,
      totp_code: payload.totpCode ?? null,
      backup_code: payload.backupCode ?? null,
      sms_otp: payload.smsOtp ?? null,
    }),
  });
  return storeAuthResponse(data);
}

export async function sendMfaLoginSms(mfaToken: string) {
  return apiRequest<OtpSendResponse>("/auth/login/mfa/send-sms", {
    method: "POST",
    body: JSON.stringify({ mfa_token: mfaToken }),
  });
}

export async function verifyLoginSms(payload: { loginToken: string; otp: string }) {
  const data = await apiRequest<AuthSuccessResponse>("/auth/login/verify-sms", {
    method: "POST",
    body: JSON.stringify({
      login_token: payload.loginToken,
      otp: payload.otp,
    }),
  });
  return storeAuthResponse(data);
}

export async function resendLoginSmsOtp(loginToken: string) {
  return apiRequest<OtpSendResponse>("/auth/login/resend-sms", {
    method: "POST",
    body: JSON.stringify({ login_token: loginToken }),
  });
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
