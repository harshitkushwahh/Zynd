"use client";

import {
  ArrowLeftRight,
  ClipboardCheck,
  FileText,
  Gauge,
  Goal,
  PieChart,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  CLIENT_DETAIL_TAB_IDS,
  type ClientDetailTabId,
} from "@/components/clients/client-detail-tab-ids";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<ClientDetailTabId, LucideIcon> = {
  portfolio: PieChart,
  kyc: ClipboardCheck,
  documents: FileText,
  risk: Gauge,
  goals: Goal,
  family: Users,
  transactions: ArrowLeftRight,
};

type ClientDetailSectionTabsProps = {
  value: ClientDetailTabId;
  onChange: (tabId: ClientDetailTabId) => void;
  className?: string;
  busy?: boolean;
};

export function ClientDetailSectionTabs({
  value,
  onChange,
  className,
  busy = false,
}: ClientDetailSectionTabsProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.tabs;

  return (
    <div
      className={cn("distributor-operations-orders-scope-tabs", className)}
      role="tablist"
      aria-busy={busy || undefined}
      aria-label={copy.ariaLabel}
    >
      {CLIENT_DETAIL_TAB_IDS.map((tabId) => {
        const active = value === tabId;
        const Icon = TAB_ICONS[tabId];
        const label = copy[tabId];
        return (
          <button
            key={tabId}
            id={`client-detail-tab-${tabId}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`client-detail-panel-${tabId}`}
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
