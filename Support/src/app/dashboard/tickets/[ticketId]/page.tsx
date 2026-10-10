import { SupportTicketDetailPage } from "@/components/tickets/support-ticket-detail-page";

type SupportTicketDetailRouteProps = {
  params: Promise<{ ticketId: string }>;
};

export default async function SupportTicketDetailRoute({ params }: SupportTicketDetailRouteProps) {
  const { ticketId } = await params;
  return <SupportTicketDetailPage ticketId={ticketId} />;
}
