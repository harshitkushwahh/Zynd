"use client";

import { LockKeyhole, Users, type LucideIcon } from "lucide-react";

import {
  BRANCH_INCENTIVES_TABLE_SUB_TAB_IDS,
  BRANCH_INCENTIVES_TABLE_SUB_TAB_LABELS,
  type BranchIncentivesTableSubTabId,
} from "@/components/dist-management/branch-incentives-table-sub-tab-ids";
import { cn } from "@/lib/utils";

const SUB_TAB_ICONS: Record<BranchIncentivesTableSubTabId, LucideIcon> = {
  "by-distributor": Users,
  "holds-releases": LockKeyhole,
};

type BranchIncentivesTableSubTabsProps = {
  value: BranchIncentivesTableSubTabId;
  onChange: (tabId: BranchIncentivesTableSubTabId) => void;
  className?: string;
  busy?: boolean;
};

export function BranchIncentivesTableSubTabs({
  value,
  onChange,
  className,
  busy = false,
}: BranchIncentivesTableSubTabsProps) {
  return (
    <div
      className={cn("distributor-operations-orders-scope-tabs", className)}
      role="tablist"
      aria-busy={busy || undefined}
      aria-label="Incentive tables"
    >
      {BRANCH_INCENTIVES_TABLE_SUB_TAB_IDS.map((tabId) => {
        const active = value === tabId;
        const Icon = SUB_TAB_ICONS[tabId];
        return (
          <button
            key={tabId}
            id={`branch-incentives-table-sub-tab-${tabId}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`branch-incentives-table-sub-panel-${tabId}`}
            className={cn(
              "distributor-operations-orders-scope-tabs__tab",
              active && "distributor-operations-orders-scope-tabs__tab--active",
            )}
            onClick={() => onChange(tabId)}
          >
            <span className="distributor-operations-orders-scope-tabs__tab-icon" aria-hidden>
              <Icon strokeWidth={2.25} />
            </span>
            {BRANCH_INCENTIVES_TABLE_SUB_TAB_LABELS[tabId]}
          </button>
        );
      })}
    </div>
  );
}
