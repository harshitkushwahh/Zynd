import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { SupportTicketPriority, SupportTicketStatus } from "@/lib/support-types";

export function ticketStatusVariant(status: SupportTicketStatus): StatusBadgeVariant {
  if (status === "resolved") return "success";
  if (status === "open") return "warning";
  return "info";
}

export function ticketPriorityVariant(priority: SupportTicketPriority): StatusBadgeVariant {
  if (priority === "high") return "destructive";
  if (priority === "medium") return "warning";
  return "neutral";
}

export function formatTicketStatus(status: SupportTicketStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatTicketPriority(priority: SupportTicketPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function formatTicketChannel(channel: "web_chat" | "email"): string {
  return channel === "web_chat" ? "Web chat" : "Email";
}

export function formatTicketTopic(topic: string): string {
  return topic.replace(/_/g, " ");
}

const TICKET_TOPIC_LABELS: Record<string, string> = {
  payment: "Redemption",
  kyc: "KYC",
  sip: "SIP",
  account: "Account",
  goals: "Goals",
  other: "Other",
};

export function formatTicketTopicLabel(topic: string): string {
  const normalized = topic.trim().toLowerCase();
  if (TICKET_TOPIC_LABELS[normalized]) return TICKET_TOPIC_LABELS[normalized];
  return formatTicketTopic(topic).replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatSupportTicketMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })
    .format(date)
    .replace(/\s?(AM|PM)$/i, (match) => ` ${match.trim().toLowerCase()}`);
}
