"use client";

import { KycDigilockerImage } from "@/features/kyc/components/kyc-digilocker-image";
import { KycRedirectProgressDialog } from "@/features/kyc/components/kyc-redirect-progress-dialog";
import { copy } from "@/shared/config/copy";

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
      showTitle={false}
      media={<KycDigilockerImage className="flex w-full justify-center" />}
    />
  );
}
