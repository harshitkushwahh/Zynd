"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { KycEsignIncompleteIllustration } from "@/features/kyc/components/kyc-esign-incomplete-illustration";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycEsignIncompleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  retrying?: boolean;
  description?: string | null;
};

export function KycEsignIncompleteDialog({
  open,
  onOpenChange,
  onRetry,
  retrying = false,
  description,
}: KycEsignIncompleteDialogProps) {
  const body = description?.trim() || copy.kyc.esign.incompleteDescription;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="kyc-redirect-dialog-overlay"
        motion="fade"
        className={cn(
          "kyc-redirect-dialog-root kyc-dialog-surface kyc-incomplete-dialog-surface z-[70] max-w-md overflow-hidden rounded-[2rem] p-0 shadow-zynd-high ring-1 ring-destructive/35 sm:max-w-md sm:rounded-[2.25rem]",
        )}
      >
        <DialogTitle className="sr-only">{copy.kyc.esign.incompleteTitle}</DialogTitle>

        <div className="px-6 py-7 sm:px-7 sm:py-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <KycEsignIncompleteIllustration />

            <div className="w-full max-w-sm space-y-2.5">
              <p className="text-body font-semibold tracking-tight text-foreground">
                {copy.kyc.esign.incompleteTitle}
              </p>
              <p className="text-caption leading-relaxed text-muted-foreground">{body}</p>
            </div>

            <Button type="button" className="w-full" disabled={retrying} onClick={onRetry}>
              {retrying ? copy.kyc.esign.retrying : copy.kyc.esign.retry}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
