"use client";

import { useMemo } from "react";

import type { PortfolioPageTab } from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import { PORTFOLIO_TAB_LIST } from "@/features/dashboard/portfolio/lib/portfolio-page-tab-meta";
import { SlidingPillTabList } from "@/shared/ui/sliding-pill-tab-list";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type PortfolioPageTabsProps = {
  value: PortfolioPageTab;
  onChange: (tab: PortfolioPageTab) => void;
  className?: string;
};

const portfolioTabButtonClass =
  "relative z-10 inline-flex shrink-0 items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition-[color,opacity] duration-200 ease-out sm:gap-1.5 sm:px-3 sm:py-2 sm:text-compact";

export function PortfolioPageTabs({ value, onChange, className }: PortfolioPageTabsProps) {
  const portfolioCopy = copy.dashboard.portfolio;

  const tabs = useMemo(
    () =>
      PORTFOLIO_TAB_LIST.map((tab) => {
        const Icon = tab.icon;
        return {
          id: tab.id,
          label: (
            <>
              <Icon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              {tab.tabLabel}
            </>
          ),
        };
      }),
    [],
  );

  return (
    <SlidingPillTabList
      layout="compact"
      ariaLabel={portfolioCopy.tabsLabel}
      tabs={tabs}
      value={value}
      onChange={onChange}
      tabClassName={portfolioTabButtonClass}
      className={cn("w-auto shrink-0", className)}
    />
  );
}
