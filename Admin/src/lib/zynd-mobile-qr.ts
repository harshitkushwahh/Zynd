import { ApiError, getAccessToken, refreshSession } from "@/lib/api-client";
import { env } from "@/lib/env";

/** Keep in sync with backend referral QR template version. */
export const BRANDED_QR_TEMPLATE_VERSION = 5;

async function fetchBrandedQrResponse(
  data: string,
  size: number,
  retry = true,
): Promise<Response> {
  const params = new URLSearchParams({
    data,
    size: String(size),
    v: String(BRANDED_QR_TEMPLATE_VERSION),
  });
  const headers = new Headers();
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${env.apiUrl}/admin/product/qr?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
    headers,
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed.ok) {
      return fetchBrandedQrResponse(data, size, false);
    }
  }

  return response;
}

export async function fetchBrandedQrBlob(data: string, size = 512): Promise<Blob> {
  const response = await fetchBrandedQrResponse(data, size);

  if (!response.ok) {
    let message = "Could not load QR code.";
    try {
      const body = (await response.json()) as {
        detail?: { message?: string } | string;
      };
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (body.detail?.message) {
        message = body.detail.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, "api_error", response.status);
  }

  return response.blob();
}
