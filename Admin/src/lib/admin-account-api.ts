import { apiRequest } from "@/lib/api-client";

export type AdminUserSession = {
  id: string;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  last_used_at: string;
  created_at: string;
  is_current: boolean;
};

export async function fetchAdminSessions() {
  return apiRequest<{ sessions: AdminUserSession[] }>("/auth/sessions");
}

export async function revokeAdminSession(sessionId: string) {
  return apiRequest<{ ok: boolean }>("/auth/sessions/revoke", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function revokeAllOtherAdminSessions() {
  return apiRequest<{ revoked: number }>("/auth/sessions/revoke-all", {
    method: "POST",
  });
}

export async function changeAdminPassword(payload: {
  currentPassword: string;
  newPassword: string;
  totpCode?: string;
}) {
  return apiRequest<{ ok: boolean }>("/auth/account/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
      totp_code: payload.totpCode ?? null,
    }),
  });
}

export async function changeAdminEmailStart(payload: {
  newEmail: string;
  currentPassword: string;
  totpCode?: string;
}) {
  return apiRequest<{ change_token: string; retry_after_seconds: number; expires_in: number }>(
    "/auth/account/change-email/start",
    {
      method: "POST",
      body: JSON.stringify({
        new_email: payload.newEmail,
        current_password: payload.currentPassword,
        totp_code: payload.totpCode ?? null,
      }),
    },
  );
}

export async function changeAdminEmailResend(changeToken: string) {
  return apiRequest<{ retry_after_seconds: number }>("/auth/account/change-email/resend", {
    method: "POST",
    body: JSON.stringify({ change_token: changeToken }),
  });
}

export async function changeAdminEmailConfirm(changeToken: string, otp: string) {
  return apiRequest<{ ok: boolean }>("/auth/account/change-email/confirm", {
    method: "POST",
    body: JSON.stringify({ change_token: changeToken, otp }),
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

export async function mfaDisable(payload: { currentPassword: string; totpCode?: string }) {
  return apiRequest<{ disabled: boolean }>("/auth/mfa/disable", {
    method: "POST",
    body: JSON.stringify({
      current_password: payload.currentPassword,
      totp_code: payload.totpCode ?? null,
    }),
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
