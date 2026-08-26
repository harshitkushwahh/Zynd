import { requestDocumentDownload } from "@/features/documents/api/documents-api";
import type { KycSignatureDraft } from "@/features/kyc/lib/kyc-journey-draft";

async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not load signature image.");
  }
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read signature image."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read signature image."));
    reader.readAsDataURL(blob);
  });
}

export async function resolveSignatureImageSrc(
  draft: Pick<KycSignatureDraft, "dataUrl" | "documentId"> | null | undefined,
): Promise<string | null> {
  if (!draft) return null;

  const dataUrl = draft.dataUrl?.trim();
  if (dataUrl) return dataUrl;

  if (!draft.documentId) return null;

  try {
    const download = await requestDocumentDownload(draft.documentId);
    return download.download_url;
  } catch {
    return null;
  }
}

export async function resolveSignatureDataUrl(draft: KycSignatureDraft): Promise<string | null> {
  const dataUrl = draft.dataUrl?.trim();
  if (dataUrl?.startsWith("data:")) return dataUrl;

  const src = await resolveSignatureImageSrc(draft);
  if (!src) return null;
  if (src.startsWith("data:")) return src;

  return urlToDataUrl(src);
}
