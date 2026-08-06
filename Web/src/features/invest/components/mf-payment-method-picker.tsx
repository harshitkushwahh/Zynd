"use client";

import { Landmark } from "lucide-react";

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
    imageSrc: "/upi.png",
  },
  {
    id: "netbanking",
    label: copy.mutualFunds.paymentCardMethodNetbanking,
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
      value={value}
      onChange={onChange}
      options={PAYMENT_METHOD_OPTIONS}
      disabled={disabled}
    />
  );
}
