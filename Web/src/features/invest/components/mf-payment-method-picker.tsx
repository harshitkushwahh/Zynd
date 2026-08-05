"use client";

import { Landmark, Smartphone } from "lucide-react";

import type { MfPaymentMethod } from "@/features/invest/api/invest-api";
import {
  MfPaymentOptionToggle,
  type MfPaymentOption,
} from "@/features/invest/components/mf-payment-option-toggle";
import { copy } from "@/shared/config/copy";

const PAYMENT_METHOD_OPTIONS: readonly MfPaymentOption<MfPaymentMethod>[] = [
  {
    id: "upi",
    label: copy.mutualFunds.paymentCardMethodUpi,
    subtitle: copy.mutualFunds.paymentCardMethodUpiSubtitle,
    icon: Smartphone,
  },
  {
    id: "netbanking",
    label: copy.mutualFunds.paymentCardMethodNetbanking,
    subtitle: copy.mutualFunds.paymentCardMethodNetbankingSubtitle,
    icon: Landmark,
  },
] as const;

export function MfPaymentMethodPicker({
  value,
  onChange,
  disabled,
}: {
  value: MfPaymentMethod;
  onChange: (value: MfPaymentMethod) => void;
  disabled?: boolean;
}) {
  return (
    <MfPaymentOptionToggle
      label={copy.mutualFunds.paymentCardMethodLabel}
      value={value}
      onChange={onChange}
      options={PAYMENT_METHOD_OPTIONS}
      disabled={disabled}
    />
  );
}
