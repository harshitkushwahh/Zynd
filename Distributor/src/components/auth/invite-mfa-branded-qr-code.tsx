"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { fetchInviteMfaQrBlob } from "@/lib/invite-mfa-qr";
import { cn } from "@/lib/utils";

type InviteMfaBrandedQrCodeProps = {
  onboardingToken: string;
  enrollToken: string;
  size?: number;
  alt: string;
};

export function InviteMfaBrandedQrCode({
  onboardingToken,
  enrollToken,
  size = 168,
  alt,
}: InviteMfaBrandedQrCodeProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!onboardingToken || !enrollToken) {
      setLoading(false);
      setFailed(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);

    void fetchInviteMfaQrBlob(onboardingToken, enrollToken, Math.max(256, size * 2))
      .then((blob) => {
        if (cancelled) return;
        setImageUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(blob);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setImageUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return null;
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enrollToken, onboardingToken, reloadKey, size]);

  useEffect(() => {
    return () => {
      setImageUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, []);

  const frameClass = "distributor-invite-mfa-qr-frame";
  const frameStyle = { width: size, height: size };

  if (loading) {
    return (
      <div className={cn(frameClass, "flex items-center justify-center")} style={frameStyle}>
        <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (failed || !imageUrl) {
    return (
      <div
        className={cn(frameClass, "flex flex-col items-center justify-center gap-3 px-4 text-center")}
        style={frameStyle}
      >
        <p className="text-caption text-muted-foreground">Could not load QR code.</p>
        <DistributorActionButton
          type="button"
          variant="outline"
          className="gap-1.5"
          onClick={() => setReloadKey((current) => current + 1)}
        >
          <RotateCcw className="size-3.5" />
          Try again
        </DistributorActionButton>
      </div>
    );
  }

  return (
    <div className={frameClass} style={frameStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        width={size}
        height={size}
        className="size-full object-contain"
      />
    </div>
  );
}
