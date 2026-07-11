import { apiRequest } from "@/lib/api-client";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { readReferralCode } from "@/features/referral/lib/referral-storage";
import { storeAuthResponse } from "@/features/auth/api/auth-response";
import type {
  AuthSuccessResponse,
  OtpSendResponse,
  SignupStartResponse,
} from "@/features/auth/api/types";

export async function signupStart(
  email: string,
  turnstileToken?: string | null,
  referralCode?: string | null,
) {
  return apiRequest<SignupStartResponse>("/auth/signup/start", {
    method: "POST",
    body: JSON.stringify({
      email,
      turnstile_token: turnstileToken ?? null,
      referral_code: referralCode ?? readReferralCode(),
    }),
  });
}

export async function signupResendEmailOtp(signupToken: string) {
  return apiRequest<OtpSendResponse>("/auth/signup/resend-email-otp", {
    method: "POST",
    body: JSON.stringify({ signup_token: signupToken }),
  });
}

export async function signupVerifyEmail(signupToken: string, otp: string) {
  return apiRequest<{ verified: boolean }>("/auth/signup/verify-email", {
    method: "POST",
    body: JSON.stringify({ signup_token: signupToken, otp }),
  });
}

export async function signupSetPassword(signupToken: string, password: string) {
  return apiRequest<{ ok: boolean }>("/auth/signup/set-password", {
    method: "POST",
    body: JSON.stringify({ signup_token: signupToken, password }),
  });
}

export async function signupSendMobileOtp(signupToken: string, mobile: string) {
  return apiRequest<OtpSendResponse>("/auth/signup/send-mobile-otp", {
    method: "POST",
    body: JSON.stringify({ signup_token: signupToken, mobile, country_code: "IN" }),
  });
}

export async function signupVerifyMobile(signupToken: string, otp: string) {
  return apiRequest<{ verified: boolean }>("/auth/signup/verify-mobile", {
    method: "POST",
    body: JSON.stringify({ signup_token: signupToken, otp }),
  });
}

export async function signupComplete(
  signupToken: string,
  profile: { firstName: string; middleName?: string; lastName: string }
) {
  const data = await apiRequest<AuthSuccessResponse>("/auth/signup/complete", {
    method: "POST",
    body: JSON.stringify({
      signup_token: signupToken,
      first_name: profile.firstName,
      middle_name: profile.middleName || null,
      last_name: profile.lastName,
      device_fingerprint: getDeviceFingerprint(),
    }),
  });
  return storeAuthResponse(data);
}
