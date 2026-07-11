"use client";

import { KycAadhaarLottie } from "@/features/kyc/components/kyc-aadhaar-lottie";
import { KycRedirectProgressDialog } from "@/features/kyc/components/kyc-redirect-progress-dialog";
import { copy } from "@/shared/config/copy";

type KycEsignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

export function KycEsignDialog({ open, onOpenChange, onComplete }: KycEsignDialogProps) {
  return (
    <KycRedirectProgressDialog
      open={open}
      onOpenChange={onOpenChange}
      onComplete={onComplete}
      copy={copy.kyc.esign}
      media={<KycAadhaarLottie className="flex justify-center" />}
    />
  );
}
