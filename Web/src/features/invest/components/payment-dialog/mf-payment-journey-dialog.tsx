"use client";

import { useEffect, useState, type ReactNode } from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MfPaymentDialogMedia } from "@/features/invest/components/payment-dialog/mf-payment-dialog-media";
import { MfPaymentProgressBar } from "@/features/invest/components/payment-dialog/mf-payment-progress-bar";
import { MfPaymentTerminalFlow } from "@/features/invest/components/payment-dialog/mf-payment-terminal-flow";
import type { MfPaymentJourneyPhase } from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

const PAYMENT_DIALOG_SHELL_CLASS = cn(
  "flex w-full flex-col overflow-hidden sm:max-w-md",
  ZYND_3XL_RADIUS_CLASS,
);

export type MfPaymentJourneyDialogProps = {
  open?: boolean;
  phase: MfPaymentJourneyPhase;
  title: string;
  subtitle?: ReactNode;
  message: string;
  statusDetail?: ReactNode;
  terminalLines?: string[];
  layout?: "default" | "terminal";
  primaryLabel?: string;
  onPrimaryAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  onOpenChange?: (open: boolean) => void;
  onDismiss?: () => void;
  allowDismiss?: boolean;
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
  terminalLines,
  layout = "default",
  primaryLabel,
  onPrimaryAction,
  secondaryLabel,
  onSecondaryAction,
  onOpenChange,
  onDismiss,
  allowDismiss = false,
  children,
  className,
}: MfPaymentJourneyDialogProps) {
  const [open, setOpen] = useState(openProp);
  const dismissible = allowDismiss || phase === "success" || phase === "error";
  const isInProgress = phase === "processing" || phase === "waiting";
  const useTerminalLayout = layout === "terminal" && isInProgress;

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
    if (isOutcomePhase || allowDismiss) {
      setOpen(false);
    }
  }

  const outcomeMessage =
    message.trim() ||
    (phase === "error" ? copy.mutualFunds.paymentJourneyFailedMessage : message.trim());

  const terminalBody = <MfPaymentTerminalFlow lines={terminalLines ?? [message]} />;

  const isOutcomePhase = phase === "success" || phase === "error";

  const dismissCloseButton = dismissible ? (
    <DialogClose
      render={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3 z-20 rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        />
      }
    >
      <XIcon className="size-4" />
    </DialogClose>
  ) : null;

  const outcomeBody = (
    <div className="relative flex flex-col items-center px-6 py-7 text-center sm:px-8 sm:py-8">
      {dismissCloseButton}
      <MfPaymentDialogMedia phase={phase} className="size-[4.75rem]" />
      <h3 className="mt-4 text-h4 font-semibold leading-snug text-foreground">{title}</h3>
      <p className="mt-2 max-w-[20rem] text-compact leading-relaxed text-muted-foreground">
        {outcomeMessage}
      </p>
      {statusDetail ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">{statusDetail}</div>
      ) : null}
      {primaryLabel && onPrimaryAction ? (
        <Button type="button" className="mt-6 w-full" onClick={handlePrimaryAction}>
          {primaryLabel}
        </Button>
      ) : null}
      {secondaryLabel && onSecondaryAction ? (
        <Button type="button" variant="ghost" className="mt-2 w-full" onClick={onSecondaryAction}>
          {secondaryLabel}
        </Button>
      ) : null}
    </div>
  );

  const inProgressBody = (
    <div className="relative px-5 py-5 sm:px-6 sm:py-6">
      {dismissCloseButton}
      {subtitle ? (
        <div className="mb-4 text-center text-compact font-medium leading-snug text-foreground">
          {subtitle}
        </div>
      ) : null}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <MfPaymentDialogMedia phase={phase} />
            {statusDetail ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
                {statusDetail}
              </div>
            ) : null}
          </div>
          <div className="mt-4 space-y-2.5">
            <MfPaymentProgressBar active label={message} />
            <p className="text-center text-caption leading-snug text-muted-foreground">{message}</p>
          </div>
        </div>
        {primaryLabel && onPrimaryAction ? (
          <Button type="button" className="mt-4 w-full" onClick={handlePrimaryAction}>
            {primaryLabel}
          </Button>
        ) : null}
        {children ? <div className="space-y-3">{children}</div> : null}
      </div>
    </div>
  );

  const dialogBody = useTerminalLayout ? terminalBody : isOutcomePhase ? outcomeBody : inProgressBody;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          PAYMENT_DIALOG_SHELL_CLASS,
          "max-h-[min(90vh,32rem)] gap-0 border-border/60 p-0 shadow-zynd-high",
          useTerminalLayout && "max-h-[min(90vh,26rem)] justify-center",
          className,
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {useTerminalLayout ? (
          <div className="px-5 py-6 sm:px-6 sm:py-7">
            {statusDetail ? (
              <p className="mb-4 text-center text-caption leading-relaxed text-muted-foreground">
                {statusDetail}
              </p>
            ) : null}
            {dialogBody}
            {subtitle ? (
              <p className="mt-4 text-center text-caption leading-snug text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
        ) : (
          dialogBody
        )}
      </DialogContent>
    </Dialog>
  );
}
