"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MfPaymentDialogMedia } from "@/features/invest/components/payment-dialog/mf-payment-dialog-media";
import { MfPaymentProgressBar } from "@/features/invest/components/payment-dialog/mf-payment-progress-bar";
import type { MfPaymentJourneyPhase } from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

export type MfPaymentJourneyDialogProps = {
  open?: boolean;
  phase: MfPaymentJourneyPhase;
  title: string;
  subtitle?: ReactNode;
  message: string;
  statusDetail?: ReactNode;
  primaryLabel?: string;
  onPrimaryAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  onOpenChange?: (open: boolean) => void;
  onDismiss?: () => void;
  children?: ReactNode;
  className?: string;
};

export function MfPaymentJourneyDialog({
  open: openProp = true,
  phase,
  title,
  subtitle,
  message,
  statusDetail,
  primaryLabel,
  onPrimaryAction,
  secondaryLabel,
  onSecondaryAction,
  onOpenChange,
  onDismiss,
  children,
  className,
}: MfPaymentJourneyDialogProps) {
  const [open, setOpen] = useState(openProp);
  const dismissible = phase === "success" || phase === "error";
  const isInProgress = phase === "processing" || phase === "waiting";
  const isTerminal = dismissible;

  useEffect(() => {
    setOpen(openProp);
  }, [openProp]);

  function handleOpenChange(nextOpen: boolean) {
    if (!dismissible && !nextOpen) return;
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      onDismiss?.();
    }
  }

  function handlePrimaryAction() {
    onPrimaryAction?.();
    if (isTerminal) {
      setOpen(false);
    }
  }

  const outcomeMessage =
    message.trim() ||
    (phase === "error" ? copy.mutualFunds.paymentJourneyFailedMessage : message.trim());

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={dismissible}
        className={cn(
          "flex max-h-[min(90vh,40rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md",
          className,
        )}
      >
        <DialogHeader className="shrink-0 items-center space-y-1 border-b border-border/60 px-6 py-4 text-center">
          <DialogTitle className="w-full text-center text-body font-semibold leading-snug">{title}</DialogTitle>
          {subtitle ? (
            typeof subtitle === "string" ? (
              <DialogDescription className="w-full text-center text-compact leading-snug">
                {subtitle}
              </DialogDescription>
            ) : (
              <div className="w-full text-center text-compact leading-snug">{subtitle}</div>
            )
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isInProgress ? (
            <div className="space-y-3">
              <div className="rounded-[var(--radius-card)] border border-border/70 bg-muted/10 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <MfPaymentDialogMedia phase={phase} />
                  {statusDetail ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
                      {statusDetail}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2">
                  <MfPaymentProgressBar active label={message} />
                  <p className="text-center text-caption leading-snug text-muted-foreground">{message}</p>
                </div>
              </div>

              {children ? <div className="space-y-3">{children}</div> : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-1 text-center">
              <MfPaymentDialogMedia phase={phase} />
              <p className="max-w-[18rem] text-compact leading-relaxed text-muted-foreground">{outcomeMessage}</p>
            </div>
          )}
        </div>

        {primaryLabel || secondaryLabel ? (
          <div className="flex shrink-0 flex-col gap-2 border-t border-border/60 px-6 py-4">
            {primaryLabel && onPrimaryAction ? (
              <Button className="w-full" onClick={handlePrimaryAction}>
                {primaryLabel}
              </Button>
            ) : null}
            {secondaryLabel && onSecondaryAction ? (
              <Button variant="ghost" className="w-full" onClick={onSecondaryAction}>
                {secondaryLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
