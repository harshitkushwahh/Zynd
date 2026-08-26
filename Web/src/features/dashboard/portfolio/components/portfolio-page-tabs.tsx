"use client";

import type { PortfolioPageTab } from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import { PORTFOLIO_TAB_LIST } from "@/features/dashboard/portfolio/lib/portfolio-page-tab-meta";
import { TAB_PILL_ACTIVE_CLASS, TAB_PILL_BASE_CLASS, TAB_PILL_INACTIVE_CLASS } from "@/shared/ui/tab-panel";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type PortfolioPageTabsProps = {
  value: PortfolioPageTab;
  onChange: (tab: PortfolioPageTab) => void;
  className?: string;
};

export function PortfolioPageTabs({ value, onChange, className }: PortfolioPageTabsProps) {
  const portfolioCopy = copy.dashboard.portfolio;

  return (
    <div
      role="tablist"
      aria-label={portfolioCopy.tabsLabel}
      className={cn(
        "flex flex-wrap justify-end gap-1 rounded-full border border-border/80 bg-muted/20 p-1",
        className,
      )}
    >
      {PORTFOLIO_TAB_LIST.map((tab) => {
        const isActive = value === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-compact font-medium whitespace-nowrap",
              TAB_PILL_BASE_CLASS,
              isActive ? TAB_PILL_ACTIVE_CLASS : TAB_PILL_INACTIVE_CLASS,
            )}
          >
            <Icon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            {tab.tabLabel}
          </button>
        );
      })}
    </div>
  );
}
