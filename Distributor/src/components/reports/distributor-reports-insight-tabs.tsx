"use client";

import { BarChart3, CalendarClock, IndianRupee, type LucideIcon } from "lucide-react";

import {
  DISTRIBUTOR_REPORTS_INSIGHT_TAB_IDS,
  distributorReportsInsightTabTitle,
  type DistributorReportsInsightTabId,
} from "@/lib/distributor-reports-insight-tabs";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<DistributorReportsInsightTabId, LucideIcon> = {
  book: BarChart3,
  sip: CalendarClock,
  incentives: IndianRupee,
};

type DistributorReportsInsightTabsProps = {
  value: DistributorReportsInsightTabId;
  onChange: (tabId: DistributorReportsInsightTabId) => void;
  className?: string;
  busy?: boolean;
};

export function DistributorReportsInsightTabs({
  value,
  onChange,
  className,
  busy = false,
}: DistributorReportsInsightTabsProps) {
  return (
    <div
      className={cn("distributor-operations-orders-scope-tabs", className)}
      role="tablist"
      aria-busy={busy || undefined}
      aria-label="Report insight views"
    >
      {DISTRIBUTOR_REPORTS_INSIGHT_TAB_IDS.map((tabId) => {
        const active = value === tabId;
        const Icon = TAB_ICONS[tabId];
        return (
          <button
            key={tabId}
            id={`distributor-reports-insight-tab-${tabId}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`distributor-reports-insight-panel-${tabId}`}
            className={cn(
              "distributor-operations-orders-scope-tabs__tab",
              active && "distributor-operations-orders-scope-tabs__tab--active",
            )}
            onClick={() => onChange(tabId)}
          >
            <span className="distributor-operations-orders-scope-tabs__tab-icon" aria-hidden>
              <Icon strokeWidth={2.25} />
            </span>
            {distributorReportsInsightTabTitle(tabId)}
          </button>
        );
      })}
    </div>
  );
}
