import { apiRequest, ApiError } from "@/lib/api-client";

import type {
  DocumentDownloadResponse,
  DocumentListResponse,
  DocumentType,
  UserDocument,
} from "@/features/documents/api/types";
import { sleep, TERMINAL_STATUSES } from "@/features/documents/lib/wait-for-document";

export async function uploadDocument(docType: DocumentType, file: File): Promise<UserDocument> {
  const formData = new FormData();
  formData.append("doc_type", docType);
  formData.append("file", file);

  return apiRequest<UserDocument>("/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export async function fetchDocuments(): Promise<UserDocument[]> {
  const response = await apiRequest<DocumentListResponse>("/documents");
  return response.documents;
}

export async function fetchLatestDocument(docType: DocumentType): Promise<UserDocument | null> {
  return apiRequest<UserDocument | null>(`/documents/${docType}/latest`);
}

export async function fetchDocument(documentId: string): Promise<UserDocument> {
  return apiRequest<UserDocument>(`/documents/${documentId}`);
}

export async function waitForDocumentReady(
  documentId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<UserDocument> {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const intervalMs = options?.intervalMs ?? 1_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const document = await fetchDocument(documentId);
    if (TERMINAL_STATUSES.has(document.status)) {
      if (document.status === "active") {
        return document;
      }
      throw new ApiError("Document processing failed.", "document_rejected", 409);
    }
    await sleep(intervalMs);
  }

  throw new ApiError("Document processing timed out.", "document_processing_timeout", 408);
}

export async function requestDocumentDownload(documentId: string): Promise<DocumentDownloadResponse> {
  return apiRequest<DocumentDownloadResponse>(`/documents/${documentId}/download`);
}

export async function fetchProfileImageUrl(): Promise<string | null> {
  const latest = await fetchLatestDocument("profile_image");
  if (!latest || latest.status !== "active") {
    return null;
  }
  const download = await requestDocumentDownload(latest.id);
  return download.download_url;
}
