export const SUPPORT_TICKET_DETAIL_TAB_IDS = [
  "conversation",
  "customer",
  "ticket-info",
  "sla",
  "activity",
  "linked",
] as const;

export type SupportTicketDetailTabId = (typeof SUPPORT_TICKET_DETAIL_TAB_IDS)[number];

export const SUPPORT_TICKET_DETAIL_TAB_LABELS: Record<SupportTicketDetailTabId, string> = {
  conversation: "Conversation",
  customer: "Customer details",
  "ticket-info": "Ticket info",
  sla: "SLA",
  activity: "Activity log",
  linked: "Linked records",
};
