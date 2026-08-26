"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  fetchMfaEnrollQrBlob,
  fetchMfaResetQrBlob,
} from "@/features/account/mfa/lib/mfa-branded-qr";
import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfaBrandedQrImageProps = {
  kind: "enroll" | "reset";
  token: string;
  alt: string;
  className?: string;
  frameClassName?: string;
  imageClassName?: string;
  fetchSize?: number;
  /** Branded logo QR PNG from enroll/reset start — shown immediately without a second request. */
  initialSrc?: string | null;
};

export function MfaBrandedQrImage({
  kind,
  token,
  alt,
  className,
  frameClassName,
  imageClassName = "size-[184px] object-contain sm:size-[200px]",
  fetchSize = 280,
  initialSrc = null,
}: MfaBrandedQrImageProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(initialSrc);
  const [loading, setLoading] = useState(!initialSrc);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) {
      setQrImageUrl((current) => {
        if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
        return null;
      });
      setLoading(false);
      setFailed(true);
      return;
    }

    if (initialSrc && reloadKey === 0) {
      setQrImageUrl(initialSrc);
      setLoading(false);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);

    const fetchBlob =
      kind === "enroll" ? fetchMfaEnrollQrBlob(token, fetchSize) : fetchMfaResetQrBlob(token, fetchSize);

    void fetchBlob
      .then((blob) => {
        if (cancelled) return;
        setQrImageUrl((current) => {
          if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
          return URL.createObjectURL(blob);
        });
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setQrImageUrl((current) => {
          if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
          return initialSrc ?? null;
        });
        setFailed(!initialSrc);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind, token, fetchSize, reloadKey, initialSrc]);

  useEffect(() => {
    return () => {
      if (qrImageUrl?.startsWith("blob:")) URL.revokeObjectURL(qrImageUrl);
    };
  }, [qrImageUrl]);

  return (
    <div className={cn("flex justify-center", className)}>
      <div
        className={cn(
          "bg-gradient-to-br from-primary/25 via-primary/10 to-emerald-500/20 p-[2px]",
          REFERRAL_CARD_RADIUS_CLASS,
          frameClassName,
        )}
      >
        <div className="rounded-[calc(var(--radius-3xl)-2px)] bg-white p-1 sm:p-1.5">
          {loading ? (
            <div className={cn("flex items-center justify-center", imageClassName)}>
              <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : qrImageUrl && !failed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImageUrl} alt={alt} className={imageClassName} width={200} height={200} />
          ) : (
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-2 px-3 text-center",
                imageClassName,
              )}
            >
              <p className="text-caption text-muted-foreground">{copy.referral.qrLoadFailed}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setReloadKey((current) => current + 1)}
              >
                <RotateCcw className="size-3.5" />
                {copy.referral.qrRetry}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
