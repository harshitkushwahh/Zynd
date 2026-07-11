"use client";

import { useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const KYC_REDIRECT_PROGRESS_DURATION_MS = 4000;

export type KycRedirectProgressCopy = {
  title: string;
  description: string;
  redirecting: string;
  secondsRemaining: (seconds: number) => string;
};

type KycRedirectProgressDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  copy: KycRedirectProgressCopy;
  media: React.ReactNode;
  durationMs?: number;
  showTitle?: boolean;
};

export function KycRedirectProgressDialog({
  open,
  onOpenChange,
  onComplete,
  copy,
  media,
  durationMs = KYC_REDIRECT_PROGRESS_DURATION_MS,
  showTitle = true,
}: KycRedirectProgressDialogProps) {
  const [progress, setProgress] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(durationMs / 1000);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    completedRef.current = false;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min(100, (elapsed / durationMs) * 100);
      const remainingMs = Math.max(0, durationMs - elapsed);

      setProgress(nextProgress);
      setSecondsLeft(Math.max(0, Math.ceil(remainingMs / 1000)));

      if (elapsed >= durationMs && !completedRef.current) {
        completedRef.current = true;
        window.clearInterval(timer);
        onComplete();
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [durationMs, onComplete, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="kyc-redirect-dialog-overlay"
        className={cn(
          "kyc-redirect-dialog-root kyc-dialog-surface z-[60] max-w-lg overflow-hidden p-0 shadow-zynd-high ring-1 ring-border"
        )}
      >
        <DialogTitle className="sr-only">{copy.title}</DialogTitle>

        <div className="px-5 py-6 sm:px-6 sm:py-7">
          <div className="flex flex-col items-center gap-5 text-center">
            {media}

            <div className="max-w-sm space-y-2">
              {showTitle ? (
                <p className="text-body font-semibold text-foreground">{copy.title}</p>
              ) : null}
              <p className="text-caption leading-relaxed text-muted-foreground">
                {copy.description}
              </p>
            </div>

            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>{copy.redirecting}</span>
                <span>{copy.secondsRemaining(secondsLeft)}</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                aria-label={copy.redirecting}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-100 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
