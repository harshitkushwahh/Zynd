"use client";

import { ArrowLeft } from "lucide-react";

import {
  MfTransactionConsentOtpSection,
  type MfTransactionConsentContext,
} from "@/features/invest/components/mf-transaction-consent-otp-section";
import {
  confirmMfPurchaseConsent,
  fetchMfPurchaseConsent,
  sendMfPurchaseConsentOtp,
} from "@/features/invest/api/invest-api";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfInvestPaymentConsentStepProps = {
  orderId: string;
  amountInr: number;
  initialConsent?: MfTransactionConsentContext | null;
  onBack: () => void;
  onConfirmed: (orderId: string) => void;
  className?: string;
};

export function MfInvestPaymentConsentStep({
  orderId,
  amountInr,
  initialConsent,
  onBack,
  onConfirmed,
  className,
}: MfInvestPaymentConsentStepProps) {
  const portfolioCopy = copy.dashboard.portfolio;
  const mfCopy = copy.mutualFunds.transactionConsent;

  return (
    <div className={cn("flex min-h-[26rem] flex-1 flex-col", className)}>
      <div className="mb-4 flex shrink-0 items-center gap-2 border-b border-border/60 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label={mfCopy.backToAmount}
        >
          <ArrowLeft className="size-4" strokeWidth={2.25} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-compact font-semibold text-foreground">{mfCopy.investStepTitle}</p>
          <p className="text-caption text-muted-foreground">
            {mfCopy.investStepAmount.replace("{amount}", formatInr(amountInr))}
          </p>
        </div>
      </div>

      <MfTransactionConsentOtpSection
        active
        embedded
        skipInitialLoad
        autoSendOtp
        autoContinueOnConfirm
        initialConsent={initialConsent ?? undefined}
        loadConsent={() => fetchMfPurchaseConsent(orderId)}
        sendOtp={() => sendMfPurchaseConsentOtp(orderId)}
        confirmOtp={(otp) => confirmMfPurchaseConsent(orderId, otp).then(() => undefined)}
        onConfirmed={() => onConfirmed(orderId)}
        onDismiss={onBack}
        confirmLabel={mfCopy.continueToPayment}
        successTitle={portfolioCopy.holdingConsentDoneTitle}
        successDescription={mfCopy.paymentUnlocked}
        loadFailedMessage={mfCopy.loadFailed}
      />
    </div>
  );
}
