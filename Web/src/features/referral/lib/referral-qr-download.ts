import {
  getAccessToken,
  getApiUrl,
  parseApiError,
  refreshSession,
} from "@/lib/api-client";

/** Bump when backend QR styling changes so clients bypass cached PNGs. */
export const REFERRAL_QR_TEMPLATE_VERSION = 5;

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }
  const basicMatch = header.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] ?? null;
}

async function fetchReferralQrResponse(size: number, retry = true): Promise<Response> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(
    `${getApiUrl()}/referrals/me/qr?size=${encodeURIComponent(String(size))}&v=${REFERRAL_QR_TEMPLATE_VERSION}`,
    {
      credentials: "include",
      cache: "no-store",
      headers,
    },
  );

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed.ok) {
      return fetchReferralQrResponse(size, false);
    }
  }

  return response;
}

export async function fetchReferralQrBlob(size = 512): Promise<{ blob: Blob; filename: string }> {
  const response = await fetchReferralQrResponse(size);

  if (!response.ok) {
    throw await parseApiError(response);
  }

  const filename =
    parseContentDispositionFilename(response.headers.get("Content-Disposition")) ??
    "zynd-referral-qr.png";
  const blob = await response.blob();
  return { blob, filename };
}

export function triggerReferralQrDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadReferralQr(code: string, size = 512) {
  const { blob, filename } = await fetchReferralQrBlob(size);
  const resolvedFilename = filename.includes(code) ? filename : `zynd-referral-${code}.png`;
  triggerReferralQrDownload(blob, resolvedFilename);
}
