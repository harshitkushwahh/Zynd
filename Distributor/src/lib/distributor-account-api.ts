import { apiRequest } from "@/lib/api-client";

export type DistributorUserSession = {
  id: string;
  browser: string | null;
  os: string | null;
  ip_address?: string | null;
  last_used_at: string;
  created_at: string;
  is_current: boolean;
};

export async function fetchDistributorSessions() {
  return apiRequest<{ sessions: DistributorUserSession[] }>("/auth/sessions");
}

export async function revokeDistributorSession(sessionId: string) {
  return apiRequest<{ ok: boolean }>("/auth/sessions/revoke", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function revokeAllOtherDistributorSessions() {
  return apiRequest<{ revoked: number }>("/auth/sessions/revoke-all", {
    method: "POST",
  });
}

export async function mfaEnrollStart() {
  return apiRequest<{
    enroll_token: string;
    qr_uri: string;
    manual_secret: string;
    expires_in: number;
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

export async function mfaResetStart(currentTotpCode: string) {
  return apiRequest<{
    reset_token: string;
    qr_uri: string;
    manual_secret: string;
    expires_in: number;
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

export async function regenerateMfaBackupCodes(payload: {
  currentPassword: string;
  totpCode?: string;
}) {
  return apiRequest<{ backup_codes: string[] }>("/auth/mfa/backup-codes/regenerate", {
    method: "POST",
    body: JSON.stringify({
      current_password: payload.currentPassword,
      totp_code: payload.totpCode ?? null,
    }),
  });
}
