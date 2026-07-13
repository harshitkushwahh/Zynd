"use client";

import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import { MfInvestPaymentCard } from "@/features/invest/components/mf-invest-payment-card";

type MfDummyInvestCardProps = {
  selectedFund?: InvestFundSummary | null;
  className?: string;
};

/** @deprecated Use `MfInvestPaymentCard` directly. */
export function MfDummyInvestCard({ selectedFund, className }: MfDummyInvestCardProps) {
  return <MfInvestPaymentCard fundName={selectedFund?.name} className={className} preview />;
}
