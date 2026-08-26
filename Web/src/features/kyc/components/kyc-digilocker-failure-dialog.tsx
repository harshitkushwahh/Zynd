"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { KycDigilockerImage } from "@/features/kyc/components/kyc-digilocker-image";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycDigilockerFailureDialogProps = {
  open: boolean;
  description?: string | null;
  onRetry: () => void;
  retrying?: boolean;
};

export function KycDigilockerFailureDialog({
  open,
  description,
  onRetry,
  retrying = false,
}: KycDigilockerFailureDialogProps) {
  const body = description?.trim() || copy.kyc.digilocker.failedDescription;

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        // Blocking dialog — only "Try DigiLocker again" proceeds.
      }}
    >
      <DialogContent
        overlayClassName="kyc-redirect-dialog-overlay"
        motion="fade"
        showCloseButton={false}
        className={cn(
          "kyc-redirect-dialog-root kyc-dialog-surface z-[70] max-w-md overflow-hidden rounded-[2rem] p-0 shadow-zynd-high ring-1 ring-border/80 sm:max-w-md sm:rounded-[2.25rem]",
        )}
      >
        <DialogTitle className="sr-only">{copy.kyc.digilocker.failedTitle}</DialogTitle>

        <div className="px-6 py-7 sm:px-7 sm:py-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <div
              className={cn(
                "flex w-full max-w-[15rem] items-center justify-center rounded-[1.75rem] border border-warning/25",
                "bg-gradient-to-br from-warning/[0.08] via-card to-muted/25 px-6 py-5 shadow-zynd-low ring-1 ring-inset ring-warning/15",
              )}
            >
              <KycDigilockerImage variant="hero" />
            </div>

            <div className="w-full max-w-sm space-y-2.5">
              <p className="text-body font-semibold tracking-tight text-foreground">
                {copy.kyc.digilocker.failedTitle}
              </p>
              <p className="text-caption leading-relaxed text-muted-foreground">{body}</p>
              <p className="rounded-[1rem] border border-warning/20 bg-warning/[0.06] px-3.5 py-3 text-left text-[11px] font-medium leading-snug text-foreground">
                {copy.kyc.digilocker.aadhaarCheckboxHint}
              </p>
            </div>

            <Button type="button" className="w-full" disabled={retrying} onClick={onRetry}>
              {retrying ? copy.kyc.digilocker.retrying : copy.kyc.digilocker.retry}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
