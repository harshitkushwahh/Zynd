"use client";

import { LockKeyhole } from "lucide-react";

import { MfPaymentLogoBadge } from "@/features/invest/components/payment-dialog/mf-payment-logo-badge";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfPaymentTrustStripProps = {
  className?: string;
};

export function MfPaymentTrustStrip({ className }: MfPaymentTrustStripProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-muted-foreground",
        className,
      )}
    >
      <MfPaymentLogoBadge className="h-7 opacity-95" />
      <span className="text-[10px] leading-none text-border/80" aria-hidden>
        |
      </span>
      <span className="inline-flex items-center gap-1 text-[10px] font-medium leading-none tracking-wide">
        <LockKeyhole className="size-2.5 shrink-0 text-muted-foreground/60" strokeWidth={2.25} aria-hidden />
        {copy.mutualFunds.paymentTrustEncrypted}
      </span>
    </div>
  );
}
