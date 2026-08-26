"use client";

import { KycDigilockerImage } from "@/features/kyc/components/kyc-digilocker-image";
import { KycRedirectProgressDialog } from "@/features/kyc/components/kyc-redirect-progress-dialog";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycDigilockerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

export function KycDigilockerDialog({ open, onOpenChange, onComplete }: KycDigilockerDialogProps) {
  return (
    <KycRedirectProgressDialog
      open={open}
      onOpenChange={onOpenChange}
      onComplete={onComplete}
      copy={copy.kyc.digilocker}
      showTitle
      media={
        <div
          className={cn(
            "flex w-full max-w-[15rem] items-center justify-center rounded-[1.75rem] border border-primary/15",
            "bg-gradient-to-br from-primary/[0.07] via-card to-muted/25 px-6 py-5 shadow-zynd-low ring-1 ring-inset ring-primary/10",
          )}
        >
          <KycDigilockerImage variant="hero" />
        </div>
      }
    />
  );
}
