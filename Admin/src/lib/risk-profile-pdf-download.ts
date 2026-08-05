import { ApiError, getAccessToken } from "@/lib/api-client";
import { env } from "@/lib/env";
import { toast } from "sonner";

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }
  const basicMatch = header.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] ?? null;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadAdminRiskProfileReport(userId: string, assessmentId: string) {
  const toastId = toast.loading("Preparing risk profile report…");

  try {
    const response = await fetch(
      `${env.apiUrl}/admin/risk-profile/users/${encodeURIComponent(userId)}/assessments/${encodeURIComponent(assessmentId)}/report/download`,
      {
        credentials: "include",
        headers: {
          ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        },
      },
    );

    if (!response.ok) {
      let message = "Could not download the risk profile report.";
      try {
        const body = (await response.json()) as { detail?: { message?: string } | string };
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

    const filename =
      parseContentDispositionFilename(response.headers.get("Content-Disposition")) ??
      "zynd-risk-profile-report.pdf";
    const blob = await response.blob();
    triggerBrowserDownload(blob, filename);
    toast.success("Report downloaded.", { id: toastId });
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Could not download the risk profile report.";
    toast.error(message, { id: toastId });
    throw error;
  }
}
