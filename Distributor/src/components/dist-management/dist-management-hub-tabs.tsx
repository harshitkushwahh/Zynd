"use client";

import { BarChart3, FileText, IndianRupee, type LucideIcon } from "lucide-react";

import {
  DIST_MANAGEMENT_HUB_TAB_IDS,
  distManagementHubTabTitle,
  type DistManagementHubTabId,
} from "@/lib/dist-management-hub-tabs";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<DistManagementHubTabId, LucideIcon> = {
  commissions: IndianRupee,
  performance: BarChart3,
  reports: FileText,
};

type DistManagementHubTabsProps = {
  value: DistManagementHubTabId;
  onChange: (tabId: DistManagementHubTabId) => void;
  className?: string;
  busy?: boolean;
};

export function DistManagementHubTabs({
  value,
  onChange,
  className,
  busy = false,
}: DistManagementHubTabsProps) {
  return (
    <div
      className={cn("distributor-operations-orders-scope-tabs", className)}
      role="tablist"
      aria-busy={busy || undefined}
      aria-label="Dist management sections"
    >
      {DIST_MANAGEMENT_HUB_TAB_IDS.map((tabId) => {
        const active = value === tabId;
        const Icon = TAB_ICONS[tabId];
        return (
          <button
            key={tabId}
            id={`dist-management-hub-tab-${tabId}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`dist-management-hub-panel-${tabId}`}
            className={cn(
              "distributor-operations-orders-scope-tabs__tab",
              active && "distributor-operations-orders-scope-tabs__tab--active",
            )}
            onClick={() => onChange(tabId)}
          >
            <span className="distributor-operations-orders-scope-tabs__tab-icon" aria-hidden>
              <Icon strokeWidth={2.25} />
            </span>
            {distManagementHubTabTitle(tabId)}
          </button>
        );
      })}
    </div>
  );
}
