"use client";

import type { SupportTicketDetailTabId } from "@/components/tickets/support-ticket-detail-tab-ids";
import { SupportTicketActivityLogPanel } from "@/components/tickets/support-ticket-activity-log-panel";
import { SupportTicketChatPanel } from "@/components/tickets/support-ticket-chat-panel";
import { SupportTicketCustomerDetailsPanel } from "@/components/tickets/support-ticket-customer-details-panel";
import { SupportTicketInfoPanel } from "@/components/tickets/support-ticket-info-panel";
import { SupportTicketLinkedRecordsPanel } from "@/components/tickets/support-ticket-linked-records-panel";
import { SupportTicketSlaTimelinePanel } from "@/components/tickets/support-ticket-sla-timeline-panel";
import { Card } from "@/components/ui/card";
import type { SupportTicketDetail } from "@/lib/support-types";
import { cn } from "@/lib/utils";

type SupportTicketDetailMainPanelProps = {
  detail: SupportTicketDetail;
  activeTab: SupportTicketDetailTabId;
  className?: string;
};

export function SupportTicketDetailMainPanel({
  detail,
  activeTab,
  className,
}: SupportTicketDetailMainPanelProps) {
  const { ticket, customer, related, activityLog, slaTab, slaLabel } = detail;

  if (activeTab === "conversation") {
    return (
      <Card
        className={cn(
          "flex h-full min-h-0 flex-col overflow-hidden p-0 shadow-sm",
          className,
        )}
      >
        <SupportTicketChatPanel ticket={ticket} className="h-full min-h-0" />
      </Card>
    );
  }

  if (activeTab === "customer") {
    return (
      <SupportTicketCustomerDetailsPanel
        customer={customer}
        clientCode={ticket.userId}
        className={className}
      />
    );
  }

  if (activeTab === "ticket-info") {
    return <SupportTicketInfoPanel ticket={ticket} slaLabel={slaLabel} className={className} />;
  }

  if (activeTab === "sla") {
    return (
      <SupportTicketSlaTimelinePanel slaTab={slaTab} className={className} />
    );
  }

  if (activeTab === "activity") {
    return (
      <SupportTicketActivityLogPanel
        entries={activityLog}
        className={cn("h-full min-h-0 flex-1", className)}
      />
    );
  }

  return <SupportTicketLinkedRecordsPanel related={related} className={className} />;
}
