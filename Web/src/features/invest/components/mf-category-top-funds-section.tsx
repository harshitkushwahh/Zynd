"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/page-title";
import { FieldMessage } from "@/components/ui/ui-message";
import type { InvestCategory, InvestFundSummary } from "@/features/invest/api/invest-api";
import { MfFundCard } from "@/features/invest/components/mf-fund-card";
import { fetchTopFundsForCategory } from "@/features/invest/lib/mf-fund-ranking";
import { copy } from "@/shared/config/copy";

type MfCategoryTopFundsSectionProps = {
  category: InvestCategory;
  onSelectFund: (fund: InvestFundSummary) => void;
};

export function MfCategoryTopFundsSection({ category, onSelectFund }: MfCategoryTopFundsSectionProps) {
  const [funds, setFunds] = useState<InvestFundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTopFundsForCategory(category.slug)
      .then((items) => {
        if (!cancelled) setFunds(items);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || copy.mutualFunds.categoryLoadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category.slug]);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <SectionTitle>{category.name}</SectionTitle>
          <p className="mt-1 text-compact text-muted-foreground">
            {copy.mutualFunds.topFundsDescription.replace("{count}", String(category.fund_count))}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={`/dashboard/mutual-funds/all?category=${category.slug}`} />}
        >
          {copy.mutualFunds.viewAll}
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {error ? <FieldMessage variant="error" message={error} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {copy.mutualFunds.loadingFunds}
        </div>
      ) : null}

      {!loading && !error && funds.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-[var(--radius-medium)] border border-dashed border-border px-6 text-center">
          <p className="text-compact text-muted-foreground">{copy.mutualFunds.categoryEmpty}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {funds.map((fund) => (
          <MfFundCard key={fund.product_id} fund={fund} onSelect={onSelectFund} />
        ))}
      </div>
    </section>
  );
}
