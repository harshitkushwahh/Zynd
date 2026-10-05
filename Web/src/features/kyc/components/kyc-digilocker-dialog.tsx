"use client";

import { KycDigilockerImage } from "@/features/kyc/components/kyc-digilocker-image";
import { KycRedirectProgressDialog } from "@/features/kyc/components/kyc-redirect-progress-dialog";
import { copy } from "@/shared/config/copy";

type KycDigilockerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  variant?: "address" | "kraProof";
};

export function KycDigilockerDialog({
  open,
  onOpenChange,
  onComplete,
  variant = "address",
}: KycDigilockerDialogProps) {
  const redirectCopy = variant === "kraProof" ? copy.kyc.kraProof : copy.kyc.digilocker;
  return (
    <KycRedirectProgressDialog
      open={open}
      onOpenChange={onOpenChange}
      onComplete={onComplete}
      copy={redirectCopy}
      showTitle
      media={<KycDigilockerImage variant="hero" />}
    />
  );
}
