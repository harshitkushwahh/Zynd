"use client";

import { useEffect, useState } from "react";

import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { SupportTicketsTable } from "@/components/tickets/support-tickets-table";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { listSupportTickets } from "@/lib/support-tickets-api";
import type { SupportTicket } from "@/lib/support-types";

export function SupportTicketsPanel() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void listSupportTickets().then((rows) => {
      if (!cancelled) {
        setTickets(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="Tickets" />

      {loading ? (
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-lg bg-muted" aria-hidden />
          <div className="h-64 animate-pulse rounded-lg bg-muted" aria-hidden />
        </div>
      ) : (
        <SupportTicketsTable tickets={tickets} showUserColumn />
      )}
    </div>
  );
}
