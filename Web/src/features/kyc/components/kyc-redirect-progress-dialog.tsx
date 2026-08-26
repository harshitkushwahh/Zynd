"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(durationMs / 1000));
  const [runId, setRunId] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const completedRef = useRef(false);

  useLayoutEffect(() => {
    if (!open) {
      setIsAnimating(false);
      setSecondsLeft(Math.ceil(durationMs / 1000));
      completedRef.current = false;
      return;
    }

    completedRef.current = false;
    setRunId((current) => current + 1);
    setIsAnimating(false);
    setSecondsLeft(Math.ceil(durationMs / 1000));
  }, [durationMs, open]);

  useEffect(() => {
    if (!open) return;

    const startedAt = Date.now();
    const animationFrame = window.requestAnimationFrame(() => {
      setIsAnimating(true);
    });

    const completeTimer = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    }, durationMs);

    const secondsTimer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remainingMs = Math.max(0, durationMs - elapsed);
      setSecondsLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
    }, 100);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(completeTimer);
      window.clearInterval(secondsTimer);
    };
  }, [durationMs, onComplete, open, runId]);

  const progressForAria = isAnimating
    ? Math.min(100, Math.round(((Math.ceil(durationMs / 1000) - secondsLeft) / Math.ceil(durationMs / 1000)) * 100))
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="kyc-redirect-dialog-overlay"
        motion="fade"
        className={cn(
          "kyc-redirect-dialog-root kyc-dialog-surface z-[60] max-w-md overflow-hidden rounded-[2rem] p-0 shadow-zynd-high ring-1 ring-border/80 sm:max-w-md sm:rounded-[2.25rem]",
        )}
      >
        <DialogTitle className="sr-only">{copy.title}</DialogTitle>

        <div className="px-6 py-7 sm:px-7 sm:py-8">
          <div className="flex flex-col items-center gap-6 text-center">
            {media}

            <div className="w-full max-w-sm space-y-2.5">
              {showTitle ? (
                <p className="text-body font-semibold tracking-tight text-foreground">{copy.title}</p>
              ) : null}
              <p className="text-caption leading-relaxed text-muted-foreground">{copy.description}</p>
            </div>

            <div className="w-full space-y-3">
              <div className="flex items-center justify-between gap-3 text-[11px] font-medium">
                <span className="text-muted-foreground">{copy.redirecting}</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary tabular-nums">
                  {copy.secondsRemaining(secondsLeft)}
                </span>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full bg-muted/80 p-0.5 ring-1 ring-inset ring-border/60"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressForAria}
                aria-label={copy.redirecting}
              >
                <div
                  key={runId}
                  className="h-full w-full origin-left rounded-full bg-gradient-to-r from-primary/85 via-primary to-primary/90 will-change-transform motion-reduce:transition-none"
                  style={{
                    transform: isAnimating ? "scaleX(1)" : "scaleX(0)",
                    transitionProperty: "transform",
                    transitionTimingFunction: "linear",
                    transitionDuration: `${durationMs}ms`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
