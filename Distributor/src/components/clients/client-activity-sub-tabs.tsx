"use client";

import { ArrowLeftRight, CalendarClock, type LucideIcon } from "lucide-react";

import {
  CLIENT_ACTIVITY_SUB_TAB_IDS,
  type ClientActivitySubTabId,
} from "@/components/clients/client-activity-sub-tab-ids";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { cn } from "@/lib/utils";

const SUB_TAB_ICONS: Record<ClientActivitySubTabId, LucideIcon> = {
  sips: CalendarClock,
  transactions: ArrowLeftRight,
};

type ClientActivitySubTabsProps = {
  value: ClientActivitySubTabId;
  onChange: (tabId: ClientActivitySubTabId) => void;
  className?: string;
  busy?: boolean;
};

export function ClientActivitySubTabs({
  value,
  onChange,
  className,
  busy = false,
}: ClientActivitySubTabsProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.activity;

  return (
    <div
      className={cn("distributor-operations-orders-scope-tabs", className)}
      role="tablist"
      aria-busy={busy || undefined}
      aria-label={copy.subTabsAriaLabel}
    >
      {CLIENT_ACTIVITY_SUB_TAB_IDS.map((tabId) => {
        const active = value === tabId;
        const Icon = SUB_TAB_ICONS[tabId];
        const label = copy.subTabs[tabId];
        return (
          <button
            key={tabId}
            id={`client-activity-sub-tab-${tabId}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`client-activity-sub-panel-${tabId}`}
            className={cn(
              "distributor-operations-orders-scope-tabs__tab",
              active && "distributor-operations-orders-scope-tabs__tab--active",
            )}
            onClick={() => onChange(tabId)}
          >
            <span className="distributor-operations-orders-scope-tabs__tab-icon" aria-hidden>
              <Icon strokeWidth={2.25} />
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
