"use client";

import { KycJsonLottie } from "@/features/kyc/components/kyc-json-lottie";
import {
  MF_PAYMENT_ERROR_LOTTIE_SRC,
  MF_PAYMENT_SUCCESS_LOTTIE_SRC,
  type MfPaymentJourneyPhase,
} from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import { MfPaymentLogoBadge } from "@/features/invest/components/payment-dialog/mf-payment-logo-badge";
import { cn } from "@/lib/utils";

type MfPaymentDialogMediaProps = {
  phase: MfPaymentJourneyPhase;
  className?: string;
};

const outcomeRingClass = {
  success: "ring-success/15 from-success/[0.08] via-card to-muted/10",
  error: "ring-destructive/15 from-destructive/[0.06] via-card to-muted/10",
} as const;

export function MfPaymentDialogMedia({ phase, className }: MfPaymentDialogMediaProps) {
  if (phase === "processing" || phase === "waiting") {
    return <MfPaymentLogoBadge className={className} />;
  }

  const lottieSrc = phase === "success" ? MF_PAYMENT_SUCCESS_LOTTIE_SRC : MF_PAYMENT_ERROR_LOTTIE_SRC;

  return (
    <div
      className={cn(
        "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ring-1 ring-inset",
        outcomeRingClass[phase],
        className,
      )}
    >
      <KycJsonLottie
        src={lottieSrc}
        loop={false}
        className="size-[4.5rem] max-h-[4.5rem] max-w-[4.5rem]"
      />
    </div>
  );
}
