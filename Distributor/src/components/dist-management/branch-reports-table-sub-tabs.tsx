"use client";

import { AlertTriangle, LineChart, Users, type LucideIcon } from "lucide-react";

import {
  BRANCH_REPORTS_TABLE_SUB_TAB_IDS,
  BRANCH_REPORTS_TABLE_SUB_TAB_LABELS,
  type BranchReportsTableSubTabId,
} from "@/components/dist-management/branch-reports-table-sub-tab-ids";
import { cn } from "@/lib/utils";

const SUB_TAB_ICONS: Record<BranchReportsTableSubTabId, LucideIcon> = {
  rollup: LineChart,
  "kyc-pending": Users,
  compliance: AlertTriangle,
};

type BranchReportsTableSubTabsProps = {
  value: BranchReportsTableSubTabId;
  onChange: (tabId: BranchReportsTableSubTabId) => void;
  className?: string;
  busy?: boolean;
};

export function BranchReportsTableSubTabs({
  value,
  onChange,
  className,
  busy = false,
}: BranchReportsTableSubTabsProps) {
  return (
    <div
      className={cn("distributor-operations-orders-scope-tabs", className)}
      role="tablist"
      aria-busy={busy || undefined}
      aria-label="Branch report tables"
    >
      {BRANCH_REPORTS_TABLE_SUB_TAB_IDS.map((tabId) => {
        const active = value === tabId;
        const Icon = SUB_TAB_ICONS[tabId];
        return (
          <button
            key={tabId}
            id={`branch-reports-table-sub-tab-${tabId}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`branch-reports-table-sub-panel-${tabId}`}
            className={cn(
              "distributor-operations-orders-scope-tabs__tab",
              active && "distributor-operations-orders-scope-tabs__tab--active",
            )}
            onClick={() => onChange(tabId)}
          >
            <span className="distributor-operations-orders-scope-tabs__tab-icon" aria-hidden>
              <Icon strokeWidth={2.25} />
            </span>
            {BRANCH_REPORTS_TABLE_SUB_TAB_LABELS[tabId]}
          </button>
        );
      })}
    </div>
  );
}
