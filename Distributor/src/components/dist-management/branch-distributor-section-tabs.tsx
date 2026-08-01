"use client";

import {
  ArrowLeftRight,
  Briefcase,
  CalendarClock,
  ClipboardCheck,
  FileBarChart,
  LayoutGrid,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  BRANCH_DISTRIBUTOR_TAB_IDS,
  BRANCH_DISTRIBUTOR_TAB_LABELS,
  type BranchDistributorTabId,
} from "@/components/dist-management/branch-distributor-tab-ids";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

const TAB_ICONS: Record<BranchDistributorTabId, LucideIcon> = {
  overview: LayoutGrid,
  clients: Users,
  transactions: ArrowLeftRight,
  sips: CalendarClock,
  reports: FileBarChart,
  compliance: ClipboardCheck,
  work: Briefcase,
};

type BranchDistributorSectionTabsProps = {
  value: BranchDistributorTabId;
  onChange: (tabId: BranchDistributorTabId) => void;
  className?: string;
  busy?: boolean;
};

export function BranchDistributorSectionTabs({
  value,
  onChange,
  className,
  busy = false,
}: BranchDistributorSectionTabsProps) {
  return (
    <div
      className={cn("distributor-operations-orders-scope-tabs", className)}
      role="tablist"
      aria-busy={busy || undefined}
      aria-label={ZYND_MITRA_COPY.profileSectionsAria}
    >
      {BRANCH_DISTRIBUTOR_TAB_IDS.map((tabId) => {
        const active = value === tabId;
        const Icon = TAB_ICONS[tabId];
        return (
          <button
            key={tabId}
            id={`branch-distributor-tab-${tabId}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`branch-distributor-panel-${tabId}`}
            className={cn(
              "distributor-operations-orders-scope-tabs__tab",
              active && "distributor-operations-orders-scope-tabs__tab--active",
            )}
            onClick={() => onChange(tabId)}
          >
            <span className="distributor-operations-orders-scope-tabs__tab-icon" aria-hidden>
              <Icon strokeWidth={2.25} />
            </span>
            {BRANCH_DISTRIBUTOR_TAB_LABELS[tabId]}
          </button>
        );
      })}
    </div>
  );
}
