"use client";

import { useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Download, QrCode } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";

type ReferralQrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  code: string;
};

export function ReferralQrDialog({ open, onOpenChange, shareUrl, code }: ReferralQrDialogProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    setDownloading(true);
    try {
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const objectUrl = URL.createObjectURL(svgBlob);
      const image = new Image();

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("QR render failed"));
        image.src = objectUrl;
      });

      const size = 512;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) return;

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);

      const pngUrl = canvas.toDataURL("image/png");
      const anchor = document.createElement("a");
      anchor.href = pngUrl;
      anchor.download = `zynd-referral-${code}.png`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.referral.qrDialogTitle}
      description={copy.referral.qrDialogDescription}
      icon={QrCode}
      maxWidth="md"
    >
      <div className="space-y-4 px-6 py-5">
        <div className="flex justify-center">
          <div
            ref={qrRef}
            className="rounded-[var(--radius-card)] border border-border bg-white p-4 shadow-zynd-low"
          >
            <QRCode value={shareUrl} size={200} aria-label={copy.referral.qrAlt} />
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-muted/20 px-4 py-3 text-center">
          <p className="text-caption text-muted-foreground">{copy.referral.codeLabel}</p>
          <p className="mt-1 font-mono text-body font-semibold tracking-wide text-foreground">{code}</p>
          <p className="mt-3 break-all font-mono text-caption text-muted-foreground">{shareUrl}</p>
        </div>
      </div>

      <BrandDialogFooter>
        <Button type="button" className="gap-2" disabled={downloading} onClick={() => void handleDownload()}>
          <Download className="size-4" />
          {downloading ? copy.referral.downloadQrLoading : copy.referral.downloadQr}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>
  );
}
