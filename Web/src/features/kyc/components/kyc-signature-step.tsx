"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import { uploadDocument, waitForDocumentReady } from "@/features/documents/api/documents-api";
import { dataUrlToFile } from "@/features/documents/lib/data-url-to-file";
import { KycSignaturePad } from "@/features/kyc/components/kyc-signature-pad";
import {
  KYC_SIGNATURE_ACCEPT,
  KYC_SIGNATURE_MAX_BYTES,
  type KycSignatureTab,
} from "@/features/kyc/lib/kyc-signature";
import type { KycSignatureDraft } from "@/features/kyc/lib/kyc-journey-draft";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";

type KycSignatureStepProps = {
  onSubmit: (value: KycSignatureDraft) => void;
};

export function KycSignatureStep({ onSubmit }: KycSignatureStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<KycSignatureTab>("draw");
  const [drawnSignature, setDrawnSignature] = useState("");
  const [uploadedSignature, setUploadedSignature] = useState("");
  const [uploadFileName, setUploadFileName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const activeSignature = activeTab === "draw" ? drawnSignature : uploadedSignature;

  const handleTabChange = (tab: KycSignatureTab) => {
    setActiveTab(tab);
    setError("");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(copy.kyc.signature.invalidFileType);
      return;
    }

    if (file.size > KYC_SIGNATURE_MAX_BYTES) {
      setError(copy.kyc.signature.fileTooLarge);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setUploadedSignature(reader.result);
      setUploadFileName(file.name);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveUpload = () => {
    setUploadedSignature("");
    setUploadFileName("");
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!activeSignature) {
      setError(
        activeTab === "draw"
          ? copy.kyc.signature.drawRequired
          : copy.kyc.signature.uploadRequired,
      );
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const extension = activeTab === "draw" ? "png" : uploadFileName.split(".").pop() || "png";
      const file = dataUrlToFile(activeSignature, `signature.${extension}`);
      const document = await uploadDocument("signature", file);
      const readyDocument = await waitForDocumentReady(document.id);

      onSubmit({
        mode: activeTab,
        dataUrl: activeSignature,
        documentId: readyDocument.id,
      });
    } catch (uploadError) {
      const message =
        uploadError instanceof ApiError ? uploadError.message : copy.kyc.signature.saveFailed;
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex rounded-[var(--radius-full)] border border-border bg-muted/40 p-1">
        {(["draw", "upload"] as const).map((tab) => {
          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              disabled={isSaving}
              className={cn(
                "flex-1 rounded-[var(--radius-full)] px-3 py-2 text-caption font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background shadow-zynd-low"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "draw" ? copy.kyc.signature.drawTab : copy.kyc.signature.uploadTab}
            </button>
          );
        })}
      </div>

      {activeTab === "draw" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">{copy.kyc.signature.drawHint}</p>
          <KycSignaturePad value={drawnSignature} onChange={setDrawnSignature} />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[11px] text-muted-foreground">{copy.kyc.signature.uploadHint}</p>

          <input
            ref={fileInputRef}
            type="file"
            accept={KYC_SIGNATURE_ACCEPT}
            className="sr-only"
            onChange={handleFileChange}
          />

          {!uploadedSignature ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
              className={cn(
                "flex w-full flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-primary/30 bg-primary/[0.03] px-5 py-8 text-center transition-colors",
                "hover:border-primary/45 hover:bg-primary/[0.06]",
              )}
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                <ImagePlus className="size-5" strokeWidth={2} />
              </div>
              <div className="space-y-1">
                <p className="text-caption font-semibold text-foreground">
                  {copy.kyc.signature.uploadTitle}
                </p>
                <p className="text-[11px] text-muted-foreground">{copy.kyc.signature.uploadFormats}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] bg-foreground px-3 py-1.5 text-[11px] font-medium text-background">
                <Upload className="size-3.5" />
                {copy.kyc.signature.chooseImage}
              </span>
            </button>
          ) : (
            <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-muted/15 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-caption font-medium text-foreground">{uploadFileName}</p>
                <Button type="button" variant="outline" size="sm" onClick={handleRemoveUpload} disabled={isSaving}>
                  <Trash2 className="size-3.5" />
                  {copy.kyc.signature.removeImage}
                </Button>
              </div>
              <div className="overflow-hidden rounded-[var(--radius-card)] border border-border/80 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedSignature}
                  alt={copy.kyc.signature.previewAlt}
                  className="mx-auto max-h-40 w-full object-contain"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {error ? <FieldMessage message={error} /> : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSaving}>
        {isSaving ? copy.kyc.signature.processing : copy.kyc.continue}
      </Button>
    </form>
  );
}
