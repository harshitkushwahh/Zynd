"use client";

import {
  Clock3,
  Link2,
  MessageSquare,
  ScrollText,
  Ticket,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  SUPPORT_TICKET_DETAIL_TAB_IDS,
  SUPPORT_TICKET_DETAIL_TAB_LABELS,
  type SupportTicketDetailTabId,
} from "@/components/tickets/support-ticket-detail-tab-ids";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<SupportTicketDetailTabId, LucideIcon> = {
  conversation: MessageSquare,
  customer: UserRound,
  "ticket-info": Ticket,
  sla: Clock3,
  activity: ScrollText,
  linked: Link2,
};

type SupportTicketDetailSectionTabsProps = {
  value: SupportTicketDetailTabId;
  onChange: (tabId: SupportTicketDetailTabId) => void;
  className?: string;
};

export function SupportTicketDetailSectionTabs({
  value,
  onChange,
  className,
}: SupportTicketDetailSectionTabsProps) {
  return (
    <div
      className={cn(
        "distributor-operations-orders-scope-tabs w-fit max-w-full shrink-0 self-start",
        className,
      )}
      role="tablist"
      aria-label="Ticket sections"
    >
      {SUPPORT_TICKET_DETAIL_TAB_IDS.map((tabId) => {
        const active = value === tabId;
        const Icon = TAB_ICONS[tabId];
        const label = SUPPORT_TICKET_DETAIL_TAB_LABELS[tabId];
        return (
          <button
            key={tabId}
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
            {label}
          </button>
        );
      })}
    </div>
  );
}
