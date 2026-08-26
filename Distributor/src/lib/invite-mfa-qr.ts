import { ApiError } from "@/lib/api-client";
import { env } from "@/lib/env";

/** Keep in sync with backend referral QR template version. */
export const BRANDED_QR_TEMPLATE_VERSION = 5;

export async function fetchInviteMfaQrBlob(
  onboardingToken: string,
  enrollToken: string,
  size = 512,
): Promise<Blob> {
  const params = new URLSearchParams({
    onboarding_token: onboardingToken,
    enroll_token: enrollToken,
    size: String(size),
    v: String(BRANDED_QR_TEMPLATE_VERSION),
  });

  const response = await fetch(`${env.apiUrl}/auth/admin-invite/mfa/qr?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });

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
