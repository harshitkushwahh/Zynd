"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchBrandedQrBlob } from "@/lib/zynd-mobile-qr";

type BrandedQrCodeProps = {
  value: string;
  size?: number;
  alt: string;
};

export function BrandedQrCode({ value, size = 168, alt }: BrandedQrCodeProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    void fetchBrandedQrBlob(value, Math.max(256, size * 2))
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
  }, [value, size, reloadKey]);

  useEffect(() => {
    return () => {
      setImageUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, []);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-white"
        style={{ width: size, height: size }}
      >
        <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (failed || !imageUrl) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-xl bg-white px-4 text-center"
        style={{ width: size, height: size }}
      >
        <p className="text-caption text-muted-foreground">Could not load QR code.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setReloadKey((current) => current + 1)}
        >
          <RotateCcw className="size-3.5" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={alt}
      width={size}
      height={size}
      className="rounded-xl bg-white object-contain"
      style={{ width: size, height: size }}
    />
  );
}
