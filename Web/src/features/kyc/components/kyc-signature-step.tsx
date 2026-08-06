"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  resolveSignatureDataUrl,
  resolveSignatureImageSrc,
} from "@/features/kyc/lib/kyc-signature-preview";
import type { KycSignatureDraft } from "@/features/kyc/lib/kyc-journey-draft";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";

type KycSignatureStepProps = {
  initialValue?: KycSignatureDraft | null;
  onSubmit: (value: KycSignatureDraft) => void;
};

type HydratedSignature = {
  mode: KycSignatureTab;
  src: string;
  documentId?: string;
  dataUrl?: string;
};

export function KycSignatureStep({ initialValue, onSubmit }: KycSignatureStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef<HydratedSignature | null>(null);
  const [activeTab, setActiveTab] = useState<KycSignatureTab>(initialValue?.mode ?? "draw");
  const [drawnSignature, setDrawnSignature] = useState("");
  const [uploadedSignature, setUploadedSignature] = useState("");
  const [uploadFileName, setUploadFileName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isHydrating, setIsHydrating] = useState(Boolean(initialValue));

  useEffect(() => {
    if (!initialValue) {
      hydratedRef.current = null;
      setIsHydrating(false);
      return;
    }

    let cancelled = false;

    async function hydrate() {
      setIsHydrating(true);
      setError("");

      try {
        const src = await resolveSignatureImageSrc(initialValue);
        if (cancelled || !src) return;

        setActiveTab(initialValue.mode);
        if (initialValue.mode === "draw") {
          setDrawnSignature(src);
        } else {
          setUploadedSignature(src);
          setUploadFileName(copy.kyc.signature.savedUploadLabel);
        }

        hydratedRef.current = {
          mode: initialValue.mode,
          src,
          documentId: initialValue.documentId,
          dataUrl: initialValue.dataUrl,
        };
      } catch {
        if (!cancelled) {
          setError(copy.kyc.signature.restoreFailed);
        }
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [initialValue]);

  const activeSignature = activeTab === "draw" ? drawnSignature : uploadedSignature;
  const isBusy = isSaving || isHydrating;
  const hasDrawnSignature = Boolean(drawnSignature);
  const hasUploadedSignature = Boolean(uploadedSignature);
  const lockedTab: KycSignatureTab | null = hasDrawnSignature
    ? "upload"
    : hasUploadedSignature
      ? "draw"
      : null;

  const handleTabChange = (tab: KycSignatureTab) => {
    if (lockedTab === tab) return;
    setActiveTab(tab);
    setError("");
  };

  const handleDrawnChange = (value: string) => {
    setDrawnSignature(value);
    if (!value && hydratedRef.current?.mode === "draw") {
      hydratedRef.current = null;
    }
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
    if (hydratedRef.current?.mode === "upload") {
      hydratedRef.current = null;
    }
  };

  const submitSavedSignature = async (saved: HydratedSignature) => {
    let dataUrl = saved.dataUrl?.startsWith("data:") ? saved.dataUrl : undefined;
    if (!dataUrl) {
      dataUrl =
        (await resolveSignatureDataUrl({
          mode: saved.mode,
          dataUrl: saved.src,
          documentId: saved.documentId,
        })) ?? undefined;
    }

    if (!dataUrl) {
      setError(copy.kyc.signature.restoreFailed);
      return;
    }

    onSubmit({
      mode: saved.mode,
      dataUrl,
      documentId: saved.documentId,
    });
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

    const saved = hydratedRef.current;
    if (
      saved?.documentId &&
      activeTab === saved.mode &&
      activeSignature === saved.src
    ) {
      setIsSaving(true);
      setError("");
      try {
        await submitSavedSignature(saved);
      } finally {
        setIsSaving(false);
      }
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
          const isLocked = lockedTab === tab;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              disabled={isBusy || isLocked}
              aria-disabled={isBusy || isLocked}
              className={cn(
                "flex-1 rounded-[var(--radius-full)] px-3 py-2 text-caption font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background shadow-zynd-low"
                  : "text-muted-foreground hover:text-foreground",
                isLocked && "cursor-not-allowed opacity-45 hover:text-muted-foreground",
              )}
            >
              {tab === "draw" ? copy.kyc.signature.drawTab : copy.kyc.signature.uploadTab}
            </button>
          );
        })}
      </div>

      {isHydrating ? (
        <div className="flex min-h-40 items-center justify-center rounded-[var(--radius-card)] border border-border bg-muted/15 px-4 py-8 text-[11px] text-muted-foreground">
          {copy.kyc.signature.loadingPreview}
        </div>
      ) : activeTab === "draw" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">{copy.kyc.signature.drawHint}</p>
          <KycSignaturePad value={drawnSignature} onChange={handleDrawnChange} disabled={isBusy} />
        </div>
      ) : (
        <div className="space-y-4">
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
              disabled={isBusy}
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
                <Button type="button" variant="outline" size="sm" onClick={handleRemoveUpload} disabled={isBusy}>
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

      <Button type="submit" size="lg" className="w-full" disabled={isBusy}>
        {isSaving ? copy.kyc.signature.processing : copy.kyc.continue}
      </Button>
    </form>
  );
}
