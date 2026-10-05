"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { KycDigilockerFailureIllustration } from "@/features/kyc/components/kyc-digilocker-failure-illustration";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycDigilockerFailureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description?: string | null;
  onRetry: () => void;
  retrying?: boolean;
};

export function KycDigilockerFailureDialog({
  open,
  onOpenChange,
  description,
  onRetry,
  retrying = false,
}: KycDigilockerFailureDialogProps) {
  const body = description?.trim() || copy.kyc.digilocker.failedDescription;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="kyc-redirect-dialog-overlay"
        motion="fade"
        showCloseButton
        className={cn(
          "kyc-redirect-dialog-root kyc-dialog-surface kyc-incomplete-dialog-surface z-[70] max-w-md overflow-hidden rounded-[2rem] p-0 shadow-zynd-high ring-1 ring-destructive/35 sm:max-w-md sm:rounded-[2.25rem]",
        )}
      >
        <DialogTitle className="sr-only">{copy.kyc.digilocker.failedTitle}</DialogTitle>

        <div className="px-6 py-7 sm:px-7 sm:py-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <KycDigilockerFailureIllustration />

            <div className="w-full max-w-sm space-y-2.5">
              <p className="text-body font-semibold tracking-tight text-foreground">
                {copy.kyc.digilocker.failedTitle}
              </p>
              <p className="text-caption leading-relaxed text-muted-foreground">{body}</p>
              <p className="rounded-[1rem] border border-destructive/20 bg-destructive/[0.06] px-3.5 py-3 text-left text-[11px] font-medium leading-snug text-foreground">
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
