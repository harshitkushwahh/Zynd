import { ApiError, getAccessToken, getApiUrl, parseApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
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

export async function downloadRiskProfileReport(assessmentId?: string) {
  const toastId = toast.loading(copy.riskProfile.historyDownloadPdfProcessing);

  try {
    const response = await fetch(
      `${getApiUrl()}/invest/risk-profile/report/download${
        assessmentId ? `?assessment_id=${encodeURIComponent(assessmentId)}` : ""
      }`,
      {
        credentials: "include",
        headers: {
          ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        },
      },
    );

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const filename =
      parseContentDispositionFilename(response.headers.get("Content-Disposition")) ??
      "zynd-risk-profile-report.pdf";
    const blob = await response.blob();
    triggerBrowserDownload(blob, filename);
    toast.success(copy.riskProfile.historyDownloadPdfReady, { id: toastId });
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : copy.riskProfile.historyDownloadPdfFailed;
    toast.error(message, { id: toastId });
    throw error;
  }
}

/** @deprecated Use downloadRiskProfileReport */
export const downloadRiskProfilePdf = downloadRiskProfileReport;
