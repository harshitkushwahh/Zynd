import { apiRequest } from "@/lib/api-client";

export async function forgotPassword(email: string, turnstileToken?: string | null) {
  return apiRequest<{ ok: boolean }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email, turnstile_token: turnstileToken ?? null }),
  });
}

export async function resetPassword(
  token: string,
  newPassword: string,
  options?: { totpCode?: string; backupCode?: string }
) {
  return apiRequest<{ ok: boolean }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      token,
      new_password: newPassword,
      totp_code: options?.totpCode ?? null,
      backup_code: options?.backupCode ?? null,
    }),
  });
}
