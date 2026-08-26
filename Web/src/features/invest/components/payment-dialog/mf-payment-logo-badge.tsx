"use client";

import Image from "next/image";

import {
  MF_PAYMENT_HORI_LOGO_DARK_SRC,
  MF_PAYMENT_HORI_LOGO_SRC,
} from "@/features/invest/components/payment-dialog/mf-payment-dialog-assets";
import { cn } from "@/lib/utils";

type MfPaymentLogoBadgeProps = {
  className?: string;
};

export function MfPaymentLogoBadge({ className }: MfPaymentLogoBadgeProps) {
  return (
    <div className={cn("flex h-8 items-center justify-center", className)}>
      <Image
        src={MF_PAYMENT_HORI_LOGO_SRC}
        alt="Zynd"
        width={120}
        height={32}
        className="h-8 w-auto max-w-[120px] object-contain dark:hidden"
        priority
      />
      <Image
        src={MF_PAYMENT_HORI_LOGO_DARK_SRC}
        alt="Zynd"
        width={120}
        height={32}
        className="hidden h-8 w-auto max-w-[120px] object-contain dark:block"
        priority
      />
    </div>
  );
}
