"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, ImagePlus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import { uploadDocument, waitForDocumentReady } from "@/features/documents/api/documents-api";
import { dataUrlToFile } from "@/features/documents/lib/data-url-to-file";
import {
  KycSignaturePad,
  type KycSignaturePadHandle,
} from "@/features/kyc/components/kyc-signature-pad";
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

function SignatureSavedPreview({
  fileName,
  src,
  onRemove,
  disabled,
}: {
  fileName: string;
  src: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-muted/15 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-caption font-medium text-foreground">{fileName}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRemove} disabled={disabled}>
          <Trash2 className="size-3.5" />
          {copy.kyc.signature.removeImage}
        </Button>
      </div>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border/80 bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={copy.kyc.signature.previewAlt}
          className="mx-auto max-h-40 w-full object-contain"
        />
      </div>
    </div>
  );
}

export function KycSignatureStep({ initialValue, onSubmit }: KycSignatureStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const padRef = useRef<KycSignaturePadHandle>(null);
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

    const draft = initialValue;
    let cancelled = false;

    async function hydrate() {
      setIsHydrating(true);
      setError("");

      try {
        const src = await resolveSignatureImageSrc(draft);
        if (cancelled || !src) return;

        setActiveTab(draft.mode);
        if (draft.mode === "draw") {
          setDrawnSignature(src);
        } else {
          setUploadedSignature(src);
          setUploadFileName(copy.kyc.signature.savedUploadLabel);
        }

        hydratedRef.current = {
          mode: draft.mode,
          src,
          documentId: draft.documentId,
          dataUrl: draft.dataUrl,
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

  const sharedPreviewSrc = uploadedSignature || drawnSignature;
  const activeSignature = activeTab === "draw" ? drawnSignature : uploadedSignature || drawnSignature;
  const isBusy = isSaving || isHydrating;
  const resolvedSignatureMode: KycSignatureTab = uploadedSignature ? "upload" : "draw";

  const handleTabChange = (tab: KycSignatureTab) => {
    setActiveTab(tab);
    setError("");
  };

  const handleClearDraw = () => {
    padRef.current?.clear();
    setDrawnSignature("");
    if (hydratedRef.current?.mode === "draw") {
      hydratedRef.current = null;
    }
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

  const handleRemoveSignature = () => {
    setUploadedSignature("");
    setUploadFileName("");
    setDrawnSignature("");
    padRef.current?.clear();
    hydratedRef.current = null;
    setError("");
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

  const persistSignatureUpload = async (signatureSrc: string, mode: KycSignatureTab) => {
    const extension = mode === "draw" ? "png" : uploadFileName.split(".").pop() || "png";
    const file = dataUrlToFile(signatureSrc, `signature.${extension}`);
    const document = await uploadDocument("signature", file);
    const readyDocument = await waitForDocumentReady(document.id);
    const payload: KycSignatureDraft = {
      mode,
      dataUrl: signatureSrc,
      documentId: readyDocument.id,
    };
    hydratedRef.current = {
      mode,
      src: signatureSrc,
      documentId: readyDocument.id,
      dataUrl: signatureSrc,
    };
    onSubmit(payload);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    let signatureSrc = activeSignature;
    if (activeTab === "draw") {
      signatureSrc = padRef.current?.flush() ?? drawnSignature;
    }

    if (!signatureSrc) {
      setError(
        activeTab === "draw"
          ? copy.kyc.signature.drawRequired
          : copy.kyc.signature.uploadRequired,
      );
      return;
    }

    const saved = hydratedRef.current;
    if (saved?.documentId && signatureSrc === saved.src) {
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
      await persistSignatureUpload(signatureSrc, resolvedSignatureMode);
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
      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-[var(--radius-full)] border border-border bg-muted/40 p-1">
          {(["draw", "upload"] as const).map((tab) => {
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(tab)}
                disabled={isBusy}
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={handleClearDraw}
            disabled={isBusy || !drawnSignature}
          >
            <Eraser className="size-3.5" aria-hidden />
            {copy.kyc.signature.clearPad}
          </Button>
        ) : null}
      </div>

      {isHydrating ? (
        <div className="flex min-h-40 items-center justify-center rounded-[var(--radius-card)] border border-border bg-muted/15 px-4 py-8 text-[11px] text-muted-foreground">
          {copy.kyc.signature.loadingPreview}
        </div>
      ) : activeTab === "draw" ? (
        <KycSignaturePad
          ref={padRef}
          value={drawnSignature}
          onChange={handleDrawnChange}
          disabled={isBusy}
        />
      ) : (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept={KYC_SIGNATURE_ACCEPT}
            className="sr-only"
            onChange={handleFileChange}
          />

          {sharedPreviewSrc ? (
            <SignatureSavedPreview
              fileName={uploadFileName || copy.kyc.signature.savedUploadLabel}
              src={sharedPreviewSrc}
              onRemove={handleRemoveSignature}
              disabled={isBusy}
            />
          ) : (
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
