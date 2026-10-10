"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/page-title";
import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import { MfHorizontalScrollRow } from "@/features/invest/components/mf-horizontal-scroll-row";
import { MfNfoFundCard } from "@/features/invest/components/mf-nfo-fund-card";
import { MF_NFO_CARD_HORIZONTAL_WIDTH_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";

type MfNfoFundsSectionProps = {
  funds: InvestFundSummary[];
  onSelectFund: (fund: InvestFundSummary) => void;
};

export function MfNfoFundsSection({ funds, onSelectFund }: MfNfoFundsSectionProps) {
  if (funds.length === 0) return null;

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <SectionTitle>{copy.mutualFunds.nfoFundsTitle}</SectionTitle>
        <Button
          variant="muted"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/mutual-funds/all?category=nfo" />}
        >
          {copy.mutualFunds.viewAll}
        </Button>
      </div>

      <MfHorizontalScrollRow>
        {funds.map((fund) => (
          <MfNfoFundCard
            key={fund.product_id}
            fund={fund}
            onSelect={onSelectFund}
            className={MF_NFO_CARD_HORIZONTAL_WIDTH_CLASS}
          />
        ))}
      </MfHorizontalScrollRow>
    </section>
  );
}
