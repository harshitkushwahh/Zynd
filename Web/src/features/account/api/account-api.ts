import { apiRequest } from "@/lib/api-client";
import type { OtpSendResponse, UserSession } from "@/features/auth/api/types";

export async function fetchSessions() {
  return apiRequest<{ sessions: UserSession[] }>("/auth/sessions");
}

export async function verifyAccountPassword(currentPassword: string) {
  return apiRequest<{ ok: boolean }>("/auth/account/verify-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword }),
  });
}

export async function revokeSession(sessionId: string) {
  return apiRequest<{ ok: boolean }>("/auth/sessions/revoke", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function revokeAllOtherSessions() {
  return apiRequest<{ revoked: number }>("/auth/sessions/revoke-all", {
    method: "POST",
  });
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
  totpCode?: string;
  smsOtp?: string;
}) {
  return apiRequest<{ ok: boolean }>("/auth/account/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
      totp_code: payload.totpCode ?? null,
      sms_otp: payload.smsOtp ?? null,
    }),
  });
}

export async function changeEmailStart(payload: {
  newEmail: string;
  currentPassword: string;
  totpCode?: string;
  smsOtp?: string;
}) {
  return apiRequest<{ change_token: string; retry_after_seconds: number; expires_in: number }>(
    "/auth/account/change-email/start",
    {
      method: "POST",
      body: JSON.stringify({
        new_email: payload.newEmail,
        current_password: payload.currentPassword,
        totp_code: payload.totpCode ?? null,
        sms_otp: payload.smsOtp ?? null,
      }),
    }
  );
}

export async function changeEmailResend(changeToken: string) {
  return apiRequest<OtpSendResponse>("/auth/account/change-email/resend", {
    method: "POST",
    body: JSON.stringify({ change_token: changeToken }),
  });
}

export async function changeEmailConfirm(changeToken: string, otp: string) {
  return apiRequest<{ ok: boolean }>("/auth/account/change-email/confirm", {
    method: "POST",
    body: JSON.stringify({ change_token: changeToken, otp }),
  });
}

export async function requestAccountDeletion(payload: {
  currentPassword: string;
  totpCode?: string;
  smsOtp?: string;
}) {
  return apiRequest<{ ok: boolean; deletion_scheduled_at: string | null }>(
    "/auth/account/delete-request",
    {
      method: "POST",
      body: JSON.stringify({
        current_password: payload.currentPassword,
        totp_code: payload.totpCode ?? null,
        sms_otp: payload.smsOtp ?? null,
      }),
    }
  );
}

export async function cancelAccountDeletion() {
  return apiRequest<{ ok: boolean }>("/auth/account/delete-cancel", {
    method: "POST",
  });
}
