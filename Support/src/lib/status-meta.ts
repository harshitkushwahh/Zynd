import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { SupportTicketPriority, SupportTicketStatus } from "@/lib/dummy/tickets";
import type { SupportUserKycStatus } from "@/lib/dummy/users";

export function ticketStatusVariant(status: SupportTicketStatus): StatusBadgeVariant {
  if (status === "open") return "info";
  if (status === "pending") return "warning";
  return "success";
}

export function ticketPriorityVariant(priority: SupportTicketPriority): StatusBadgeVariant {
  if (priority === "high") return "destructive";
  if (priority === "medium") return "warning";
  return "neutral";
}

export function kycStatusVariant(status: SupportUserKycStatus): StatusBadgeVariant {
  if (status === "verified") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "destructive";
  return "neutral";
}

export function labelize(value: string): string {
  return value.replaceAll("_", " ");
}
