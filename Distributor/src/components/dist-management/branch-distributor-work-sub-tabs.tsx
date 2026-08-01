"use client";

import { CalendarClock, Clock3, FileText, type LucideIcon } from "lucide-react";

import {
  BRANCH_DISTRIBUTOR_WORK_SUB_TAB_IDS,
  BRANCH_DISTRIBUTOR_WORK_SUB_TAB_LABELS,
  type BranchDistributorWorkSubTabId,
} from "@/components/dist-management/branch-distributor-work-sub-tab-ids";
import { cn } from "@/lib/utils";

const SUB_TAB_ICONS: Record<BranchDistributorWorkSubTabId, LucideIcon> = {
  hours: Clock3,
  attendance: CalendarClock,
  leave: FileText,
};

type BranchDistributorWorkSubTabsProps = {
  value: BranchDistributorWorkSubTabId;
  onChange: (tabId: BranchDistributorWorkSubTabId) => void;
  className?: string;
  busy?: boolean;
};

export function BranchDistributorWorkSubTabs({
  value,
  onChange,
  className,
  busy = false,
}: BranchDistributorWorkSubTabsProps) {
  return (
    <div
      className={cn("distributor-operations-orders-scope-tabs", className)}
      role="tablist"
      aria-busy={busy || undefined}
      aria-label="Work sections"
    >
      {BRANCH_DISTRIBUTOR_WORK_SUB_TAB_IDS.map((tabId) => {
        const active = value === tabId;
        const Icon = SUB_TAB_ICONS[tabId];
        return (
          <button
            key={tabId}
            id={`branch-distributor-work-sub-tab-${tabId}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`branch-distributor-work-sub-panel-${tabId}`}
            className={cn(
              "distributor-operations-orders-scope-tabs__tab",
              active && "distributor-operations-orders-scope-tabs__tab--active",
            )}
            onClick={() => onChange(tabId)}
          >
            <span className="distributor-operations-orders-scope-tabs__tab-icon" aria-hidden>
              <Icon strokeWidth={2.25} />
            </span>
            {BRANCH_DISTRIBUTOR_WORK_SUB_TAB_LABELS[tabId]}
          </button>
        );
      })}
    </div>
  );
}
