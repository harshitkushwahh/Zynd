"use client";

import { useEffect, useState } from "react";

import { SupportTicketsTable } from "@/components/tickets/support-tickets-table";
import { listSupportTickets } from "@/lib/support-tickets-api";
import type { SupportTicket } from "@/lib/support-types";

type ClientSupportTicketsTabPanelProps = {
  clientId: string;
  className?: string;
};

export function ClientSupportTicketsTabPanel({ clientId, className }: ClientSupportTicketsTabPanelProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listSupportTickets(clientId).then((rows) => {
      if (!cancelled) {
        setTickets(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className={className}>
        <div className="h-10 animate-pulse rounded-lg bg-muted" aria-hidden />
        <div className="mt-3 h-48 animate-pulse rounded-lg bg-muted" aria-hidden />
      </div>
    );
  }

  return <SupportTicketsTable tickets={tickets} className={className} />;
}
