"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import { MfFundCard } from "@/features/invest/components/mf-fund-card";
import { MF_FUNDS_GRID_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";

type MfPopularFundsSectionProps = {
  funds: InvestFundSummary[];
  onSelectFund: (productId: string) => void;
};

export function MfPopularFundsSection({ funds, onSelectFund }: MfPopularFundsSectionProps) {
  if (funds.length === 0) return null;

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-h3 font-semibold text-foreground">{copy.mutualFunds.popularFundsTitle}</h2>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/mutual-funds/collections/high-return" />}
        >
          {copy.mutualFunds.viewAll}
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className={MF_FUNDS_GRID_CLASS}>
        {funds.map((fund) => (
          <MfFundCard key={fund.product_id} fund={fund} onSelect={onSelectFund} />
        ))}
      </div>
    </section>
  );
}
