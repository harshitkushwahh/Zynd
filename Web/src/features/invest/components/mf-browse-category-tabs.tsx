"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import type { InvestCategory, InvestFundSummary } from "@/features/invest/api/invest-api";
import { MfFundCard, MfFundCardSkeletonGrid } from "@/features/invest/components/mf-fund-card";
import {
  mfFundCategoryMetaFor,
  resolveMfFundCategoryFromSlug,
} from "@/features/invest/components/mf-fund-category-badge";
import { fetchTopFundsForCategory } from "@/features/invest/lib/mf-fund-ranking";
import {
  MF_CARD_RADIUS_CLASS,
  MF_FUNDS_GRID_CLASS,
} from "@/features/invest/lib/mf-ui";
import { SectionTitle } from "@/components/ui/page-title";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export const MF_BROWSE_TAB_CATEGORY_SLUGS = ["equity-funds", "debt-funds", "liquid-funds"] as const;

const BROWSE_TAB_SKELETON_COUNT = 5;

function categoryTabLabel(name: string) {
  return name.replace(/\s+Funds$/i, "");
}

type MfBrowseCategoryTabsProps = {
  categories: InvestCategory[];
  onSelectFund: (fund: InvestFundSummary) => void;
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
  const [fundsCache, setFundsCache] = useState<Record<string, InvestFundSummary[]>>({});
  const [loadingSlug, setLoadingSlug] = useState<string | null>(tabCategories[0]?.slug ?? null);
  const [errorBySlug, setErrorBySlug] = useState<Record<string, string>>({});
  const fundsCacheRef = useRef(fundsCache);

  fundsCacheRef.current = fundsCache;

  const activeCategory = tabCategories.find((category) => category.slug === activeSlug) ?? tabCategories[0];
  const activeFunds = activeCategory ? fundsCache[activeCategory.slug] : undefined;
  const activeError = activeCategory ? errorBySlug[activeCategory.slug] : null;
  const isLoadingActive = Boolean(activeCategory && loadingSlug === activeCategory.slug);

  useEffect(() => {
    if (tabCategories.length === 0) return;
    if (!activeSlug || !tabCategories.some((category) => category.slug === activeSlug)) {
      setActiveSlug(tabCategories[0].slug);
    }
  }, [activeSlug, tabCategories]);

  useEffect(() => {
    if (!activeCategory) return;

    const slug = activeCategory.slug;
    if (fundsCacheRef.current[slug]) {
      setLoadingSlug((current) => (current === slug ? null : current));
      return;
    }

    let cancelled = false;
    setLoadingSlug(slug);
    setErrorBySlug((current) => {
      if (!current[slug]) return current;
      const next = { ...current };
      delete next[slug];
      return next;
    });

    fetchTopFundsForCategory(slug)
      .then((items) => {
        if (cancelled) return;
        setFundsCache((current) => ({ ...current, [slug]: items }));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setErrorBySlug((current) => ({
          ...current,
          [slug]: err.message || copy.mutualFunds.categoryLoadError,
        }));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSlug((current) => (current === slug ? null : current));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCategory?.slug]);

  const handleTabChange = useCallback((slug: string) => {
    startTransition(() => {
      setActiveSlug(slug);
      setLoadingSlug(fundsCacheRef.current[slug] ? null : slug);
    });
  }, []);

  if (tabCategories.length === 0) return null;

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <SectionTitle className="shrink-0">{copy.mutualFunds.browseByCategoryTitle}</SectionTitle>

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <div
            className={cn(
              MF_CARD_RADIUS_CLASS,
              "inline-flex max-w-full shrink-0 items-center gap-0.5 overflow-x-auto border border-border/70 bg-muted/25 p-0.5",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
            role="tablist"
            aria-label={copy.mutualFunds.browseByCategoryTitle}
          >
            {tabCategories.map((category) => {
              const isActive = category.slug === activeCategory?.slug;
              const isLoading = loadingSlug === category.slug;
              const categoryKind = resolveMfFundCategoryFromSlug(category.slug);
              const categoryMeta = categoryKind ? mfFundCategoryMetaFor(categoryKind) : null;
              const CategoryIcon = categoryMeta?.icon;
              const tabLabel = categoryTabLabel(category.name);

              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-busy={isLoading}
                  onClick={() => handleTabChange(category.slug)}
                  className={cn(
                    "shrink-0 rounded-[calc(var(--radius-medium)-0.125rem)] px-1 py-1 active:transform-none",
                    isLoading && isActive && "opacity-80",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-7 min-w-[5rem] items-center justify-center gap-1 rounded-[var(--radius-control)] px-3 py-0 text-caption font-semibold sm:text-compact",
                      isActive
                        ? "bg-[var(--zynd-white)] text-foreground shadow-zynd-low dark:bg-card"
                        : "text-muted-foreground",
                    )}
                  >
                    {CategoryIcon ? (
                      <CategoryIcon className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
                    ) : null}
                    {tabLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {activeCategory ? (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
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
      </div>

      <div className="relative min-h-[12rem] min-w-0">
        {activeError ? <FieldMessage variant="error" message={activeError} className="mb-4" /> : null}

        {isLoadingActive ? (
          <MfFundCardSkeletonGrid
            count={BROWSE_TAB_SKELETON_COUNT}
            className="animate-in fade-in duration-200"
          />
        ) : null}

        {!isLoadingActive && activeFunds && activeFunds.length === 0 && !activeError ? (
          <div className="flex min-h-[12rem] items-center justify-center text-compact text-muted-foreground">
            {copy.mutualFunds.categoryEmpty}
          </div>
        ) : null}

        {!isLoadingActive && activeFunds && activeFunds.length > 0 ? (
          <div
            key={activeCategory?.slug}
            className={cn(MF_FUNDS_GRID_CLASS, "animate-in fade-in duration-300")}
          >
            {activeFunds.map((fund) => (
              <MfFundCard key={fund.product_id} fund={fund} onSelect={onSelectFund} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
