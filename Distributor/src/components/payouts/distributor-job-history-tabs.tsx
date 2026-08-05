"use client";

import { FileSpreadsheet, Wallet } from "lucide-react";

import {
  DISTRIBUTOR_JOB_HISTORY_TAB_IDS,
  distributorJobHistoryTabTitle,
  type DistributorJobHistoryTabId,
} from "@/lib/distributor-job-history-tabs";
import { cn } from "@/lib/utils";

const TAB_ICONS = {
  salary: Wallet,
  commission: FileSpreadsheet,
} as const;

type DistributorJobHistoryTabsProps = {
  value: DistributorJobHistoryTabId;
  onChange: (tabId: DistributorJobHistoryTabId) => void;
  className?: string;
};

export function DistributorJobHistoryTabs({
  value,
  onChange,
  className,
}: DistributorJobHistoryTabsProps) {
  return (
    <div
      className={cn("distributor-operations-orders-scope-tabs", className)}
      role="tablist"
      aria-label="Payroll and commission history"
    >
      {DISTRIBUTOR_JOB_HISTORY_TAB_IDS.map((tabId) => {
        const active = value === tabId;
        const Icon = TAB_ICONS[tabId];
        return (
          <button
            key={tabId}
            id={`distributor-job-history-tab-${tabId}`}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "distributor-operations-orders-scope-tabs__tab",
              active && "distributor-operations-orders-scope-tabs__tab--active",
            )}
            onClick={() => onChange(tabId)}
          >
            <span className="distributor-operations-orders-scope-tabs__tab-icon" aria-hidden>
              <Icon strokeWidth={2.25} />
            </span>
            {distributorJobHistoryTabTitle(tabId)}
          </button>
        );
      })}
    </div>
  );
}
