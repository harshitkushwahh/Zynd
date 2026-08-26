"use client";

import { useEffect, useState } from "react";

import { resolveSignatureImageSrc } from "@/features/kyc/lib/kyc-signature-preview";
import type { KycSignatureDraft } from "@/features/kyc/lib/kyc-journey-draft";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycSignaturePreviewProps = {
  signature: KycSignatureDraft;
  className?: string;
  imageClassName?: string;
};

export function KycSignaturePreview({
  signature,
  className,
  imageClassName,
}: KycSignaturePreviewProps) {
  const [src, setSrc] = useState<string | null>(signature.dataUrl?.trim() || null);
  const [loading, setLoading] = useState(!signature.dataUrl?.trim() && Boolean(signature.documentId));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (signature.dataUrl?.trim()) {
        setSrc(signature.dataUrl.trim());
        setLoading(false);
        return;
      }

      if (!signature.documentId) {
        setSrc(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const resolved = await resolveSignatureImageSrc(signature);
      if (cancelled) return;
      setSrc(resolved);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [signature.dataUrl, signature.documentId]);

  if (loading) {
    return (
      <div
        className={cn(
          "flex min-h-28 items-center justify-center rounded-[var(--radius-card)] border border-border/80 bg-muted/20 p-3 text-[11px] text-muted-foreground",
          className,
        )}
      >
        {copy.kyc.signature.loadingPreview}
      </div>
    );
  }

  if (!src) return null;

  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-card)] border border-border/80 bg-white p-3", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={copy.kyc.signature.previewAlt}
        className={cn("mx-auto max-h-28 w-full object-contain", imageClassName)}
      />
    </div>
  );
}
