"use client";

import { Landmark } from "lucide-react";

import type { MfMandateType } from "@/features/invest/api/invest-api";
import {
  MfPaymentOptionToggle,
  type MfPaymentOption,
} from "@/features/invest/components/mf-payment-option-toggle";
import { copy } from "@/shared/config/copy";

const MANDATE_TYPE_OPTIONS: readonly MfPaymentOption<MfMandateType>[] = [
  {
    id: "upi",
    label: copy.mutualFunds.paymentCardMandateTypeUpi,
    imageSrc: "/upi.png",
  },
  {
    id: "nach",
    label: copy.mutualFunds.paymentCardMandateTypeNach,
    icon: Landmark,
  },
] as const;

export function MfMandateTypePicker({
  value,
  onChange,
  disabled,
}: {
  value: MfMandateType;
  onChange: (value: MfMandateType) => void;
  disabled?: boolean;
}) {
  return (
    <MfPaymentOptionToggle
      value={value}
      onChange={onChange}
      options={MANDATE_TYPE_OPTIONS}
      disabled={disabled}
    />
  );
}
