import { apiRequest } from "@/lib/api-client";
import type { AuthSecurityPolicy } from "@/features/auth/api/types";
import type { OtpSendResponse } from "@/features/auth/api/types";

export async function mfaEnrollStart() {
  return apiRequest<{
    enroll_token: string;
    qr_uri: string;
    manual_secret: string;
    expires_in: number;
    qr_png_base64?: string;
  }>("/auth/mfa/enroll/start", { method: "POST" });
}

export async function mfaEnrollConfirm(enrollToken: string, totpCode: string) {
  return apiRequest<{
    enrolled: boolean;
    backup_codes: string[];
    mfa_enrolled_at: string | null;
  }>("/auth/mfa/enroll/confirm", {
    method: "POST",
    body: JSON.stringify({ enroll_token: enrollToken, totp_code: totpCode }),
  });
}

export async function fetchMfaBackupCodesStatus() {
  return apiRequest<{
    enrolled: boolean;
    total: number;
    remaining: number;
    used: number;
  }>("/auth/mfa/backup-codes/status");
}

export async function regenerateMfaBackupCodes(payload: {
  currentPassword: string;
  totpCode?: string;
  smsOtp?: string;
}) {
  return apiRequest<{ backup_codes: string[] }>("/auth/mfa/backup-codes/regenerate", {
    method: "POST",
    body: JSON.stringify({
      current_password: payload.currentPassword,
      totp_code: payload.totpCode ?? null,
      sms_otp: payload.smsOtp ?? null,
    }),
  });
}

export async function mfaResetStart(currentTotpCode: string) {
  return apiRequest<{
    reset_token: string;
    qr_uri: string;
    manual_secret: string;
    expires_in: number;
    qr_png_base64?: string;
  }>("/auth/mfa/reset/start", {
    method: "POST",
    body: JSON.stringify({ current_totp_code: currentTotpCode }),
  });
}

export async function mfaResetConfirm(resetToken: string, totpCode: string) {
  return apiRequest<{
    enrolled: boolean;
    backup_codes: string[];
    mfa_enrolled_at: string | null;
  }>("/auth/mfa/reset/confirm", {
    method: "POST",
    body: JSON.stringify({ reset_token: resetToken, totp_code: totpCode }),
  });
}

export async function mfaDisable(payload: {
  currentPassword: string;
  totpCode?: string;
  smsOtp?: string;
}) {
  return apiRequest<{ disabled: boolean }>("/auth/mfa/disable", {
    method: "POST",
    body: JSON.stringify({
      current_password: payload.currentPassword,
      totp_code: payload.totpCode ?? null,
      sms_otp: payload.smsOtp ?? null,
    }),
  });
}

export async function checkFundEligibility() {
  return apiRequest<{ eligible: boolean; reasons: string[] }>("/auth/fund-eligibility/check");
}

export async function fetchFundEligibilityStatus() {
  return apiRequest<{
    eligible: boolean;
    reasons: string[];
    next_action: "verify_email" | "verify_phone" | "setup_mfa" | "setup_pin" | null;
    email_verified: boolean;
    mfa_enrolled: boolean;
    pin_enrolled: boolean;
    phone_verified: boolean;
  }>("/auth/fund-eligibility/status");
}

export async function fetchAuthSecurityPolicy() {
  return apiRequest<AuthSecurityPolicy>("/auth/security-policy");
}
