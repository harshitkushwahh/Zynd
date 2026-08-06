"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Loader2, QrCode, RotateCcw } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import {
  downloadReferralQr,
  fetchReferralQrBlob,
  triggerReferralQrDownload,
} from "@/features/referral/lib/referral-qr-download";
import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ReferralQrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  code: string;
};

function ReferralCopyIconButton({
  value,
  ariaLabel,
  resetKey,
}: {
  value: string;
  ariaLabel: string;
  resetKey: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setCopied(false);
  }, [resetKey]);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      setCopied(true);
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 2000);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-8 text-muted-foreground hover:text-foreground"
        aria-label={ariaLabel}
        onClick={() => void handleCopy()}
      >
        {copied ? (
          <Check className="size-4 text-success" strokeWidth={2.25} aria-hidden />
        ) : (
          <Copy className="size-4" strokeWidth={2.25} aria-hidden />
        )}
      </Button>
      {copied ? (
        <span
          role="status"
          className="pointer-events-none absolute bottom-[calc(100%+0.375rem)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-caption text-background shadow-zynd-low animate-in fade-in zoom-in-95"
        >
          {copy.referral.copied}
        </span>
      ) : null}
    </div>
  );
}

function ReferralCopyField({
  label,
  value,
  copyAriaLabel,
  resetKey,
  mono = true,
}: {
  label: string;
  value: string;
  copyAriaLabel: string;
  resetKey: boolean;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-caption font-medium text-muted-foreground">{label}</p>
      <div className="flex min-w-0 items-center gap-1 rounded-[var(--radius-control)] border border-border bg-muted/15 py-1 pl-3 pr-1">
        <p
          className={cn(
            "min-w-0 flex-1 py-1.5 leading-snug text-foreground",
            mono ? "truncate font-mono text-compact font-semibold tracking-wide" : "break-all text-caption",
          )}
        >
          {value}
        </p>
        <ReferralCopyIconButton value={value} ariaLabel={copyAriaLabel} resetKey={resetKey} />
      </div>
    </div>
  );
}

export function ReferralQrDialog({ open, onOpenChange, shareUrl, code }: ReferralQrDialogProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrBlob, setQrBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) {
      setQrImageUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setQrBlob(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchReferralQrBlob(512)
      .then(({ blob }) => {
        if (cancelled) return;
        setQrBlob(blob);
        setQrImageUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(blob);
        });
      })
      .catch(() => {
        if (cancelled) return;
        setQrBlob(null);
        setQrImageUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, shareUrl, reloadKey]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (qrBlob) {
        triggerReferralQrDownload(qrBlob, `zynd-referral-${code}.png`);
        return;
      }
      await downloadReferralQr(code, 512);
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
      <div className="space-y-5 px-6 py-5">
        <div className="flex justify-center">
          <div className={cn("bg-gradient-to-br from-primary/25 via-primary/10 to-emerald-500/20 p-[3px]", REFERRAL_CARD_RADIUS_CLASS)}>
            <div className="rounded-[calc(var(--radius-3xl)-2px)] bg-white p-4 sm:p-5">
              {loading ? (
                <div className="flex size-[220px] items-center justify-center sm:size-[240px]">
                  <Loader2 className="size-9 animate-spin text-muted-foreground" aria-hidden />
                </div>
              ) : qrImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrImageUrl}
                  alt={copy.referral.qrAlt}
                  width={240}
                  height={240}
                  className="size-[220px] object-contain sm:size-[240px]"
                />
              ) : (
                <div className="flex size-[220px] flex-col items-center justify-center gap-3 px-4 text-center sm:size-[240px]">
                  <p className="text-compact text-muted-foreground">{copy.referral.qrLoadFailed}</p>
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

        <div className="space-y-3">
          <ReferralCopyField
            label={copy.referral.codeLabel}
            value={code}
            copyAriaLabel={copy.referral.copyCodeLabel}
            resetKey={open}
          />
          <ReferralCopyField
            label={copy.referral.shareLinkLabel}
            value={shareUrl}
            copyAriaLabel={copy.referral.copyLink}
            resetKey={open}
            mono={false}
          />
        </div>
      </div>

      <BrandDialogFooter>
        <Button
          type="button"
          className="gap-2"
          disabled={downloading || loading || !qrImageUrl}
          onClick={() => void handleDownload()}
        >
          <Download className="size-4" />
          {downloading ? copy.referral.downloadQrLoading : copy.referral.downloadQr}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>
  );
}
