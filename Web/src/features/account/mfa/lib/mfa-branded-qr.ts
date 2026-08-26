import {
  getAccessToken,
  getApiUrl,
  parseApiError,
  refreshSession,
} from "@/lib/api-client";
import { REFERRAL_QR_TEMPLATE_VERSION } from "@/features/referral/lib/referral-qr-download";

type MfaBrandedQrKind = "enroll" | "reset";

async function fetchMfaBrandedQrResponse(
  kind: MfaBrandedQrKind,
  token: string,
  size: number,
  retry = true,
): Promise<Response> {
  const headers = new Headers();
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const tokenParam = kind === "enroll" ? "enroll_token" : "reset_token";
  const path = kind === "enroll" ? "/auth/mfa/enroll/qr" : "/auth/mfa/reset/qr";
  const response = await fetch(
    `${getApiUrl()}${path}?${tokenParam}=${encodeURIComponent(token)}&size=${encodeURIComponent(String(size))}&v=${REFERRAL_QR_TEMPLATE_VERSION}`,
    {
      credentials: "include",
      cache: "no-store",
      headers,
    },
  );

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed.ok) {
      return fetchMfaBrandedQrResponse(kind, token, size, false);
    }
  }

  return response;
}

export async function fetchMfaEnrollQrBlob(enrollToken: string, size = 256) {
  const response = await fetchMfaBrandedQrResponse("enroll", enrollToken, size);
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return response.blob();
}

export async function fetchMfaResetQrBlob(resetToken: string, size = 256) {
  const response = await fetchMfaBrandedQrResponse("reset", resetToken, size);
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return response.blob();
}
