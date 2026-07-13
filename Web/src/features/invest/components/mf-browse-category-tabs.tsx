"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldMessage } from "@/components/ui/ui-message";
import type { InvestCategory, InvestFundSummary } from "@/features/invest/api/invest-api";
import { MfFundCard } from "@/features/invest/components/mf-fund-card";
import { fetchTopFundsForCategory } from "@/features/invest/lib/mf-fund-ranking";
import { MF_CARD_RADIUS_CLASS, MF_FUNDS_GRID_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export const MF_BROWSE_TAB_CATEGORY_SLUGS = ["equity-funds", "debt-funds", "liquid-funds"] as const;

type MfBrowseCategoryTabsProps = {
  categories: InvestCategory[];
  onSelectFund: (productId: string) => void;
};

export function MfBrowseCategoryTabs({ categories, onSelectFund }: MfBrowseCategoryTabsProps) {
  const tabCategories = useMemo(
    () =>
      MF_BROWSE_TAB_CATEGORY_SLUGS.map((slug) => categories.find((category) => category.slug === slug)).filter(
        (category): category is InvestCategory => Boolean(category),
      ),
    [categories],
  );

  const [activeSlug, setActiveSlug] = useState<string>(tabCategories[0]?.slug ?? "");
  const [funds, setFunds] = useState<InvestFundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeCategory = tabCategories.find((category) => category.slug === activeSlug) ?? tabCategories[0];

  useEffect(() => {
    if (tabCategories.length === 0) return;
    if (!activeSlug || !tabCategories.some((category) => category.slug === activeSlug)) {
      setActiveSlug(tabCategories[0].slug);
    }
  }, [activeSlug, tabCategories]);

  useEffect(() => {
    if (!activeCategory) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTopFundsForCategory(activeCategory.slug)
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
  }, [activeCategory]);

  if (tabCategories.length === 0) return null;

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-h3 font-semibold text-foreground">{copy.mutualFunds.browseByCategoryTitle}</h2>
        {activeCategory ? (
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={
              <Link href={`/dashboard/mutual-funds/all?category=${activeCategory.slug}`} />
            }
          >
            {copy.mutualFunds.viewAll}
            <ChevronRight className="size-4" />
          </Button>
        ) : null}
      </div>

      <Card className={cn(MF_CARD_RADIUS_CLASS, "min-w-0 overflow-hidden")}>
        <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-border px-4 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabCategories.map((category) => {
            const isActive = category.slug === activeCategory?.slug;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveSlug(category.slug)}
                className={cn(
                  "shrink-0 rounded-t-[var(--radius-control)] px-4 py-2.5 text-compact font-medium transition-colors",
                  isActive
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {category.name.replace(" Funds", "")}
              </button>
            );
          })}
        </div>

        <CardContent className="min-w-0 p-4 sm:p-5">
          {error ? <FieldMessage variant="error" message={error} className="mb-4" /> : null}

          {loading ? (
            <div className="flex min-h-[160px] items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              {copy.mutualFunds.loadingFunds}
            </div>
          ) : null}

          {!loading && !error && funds.length === 0 ? (
            <div className="flex min-h-[160px] items-center justify-center text-compact text-muted-foreground">
              {copy.mutualFunds.categoryEmpty}
            </div>
          ) : null}

          {!loading && funds.length > 0 ? (
            <div className={MF_FUNDS_GRID_CLASS}>
              {funds.map((fund) => (
                <MfFundCard key={fund.product_id} fund={fund} onSelect={onSelectFund} />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
