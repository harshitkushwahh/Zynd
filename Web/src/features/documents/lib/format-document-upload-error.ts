import { ApiError } from "@/lib/api-client";

export function formatDocumentUploadError(
  error: unknown,
  fallbackMessage = "Could not upload file.",
): string {
  if (error instanceof ApiError) {
    if (error.code === "document_processing_timeout") {
      return "File uploaded but scanning is still running. Start the document scan worker, or set DOCUMENT_SCAN_DISPATCH_MODE=sync in Backend .env and restart the API.";
    }
    if (error.code === "scan_unavailable") {
      return "We couldn't verify this file right now. Try again in a moment, or disable ClamAV in local development.";
    }
    if (error.code === "scan_failed") {
      return "We couldn't verify this file. Try a different image.";
    }
    return error.message;
  }

  return fallbackMessage;
}
