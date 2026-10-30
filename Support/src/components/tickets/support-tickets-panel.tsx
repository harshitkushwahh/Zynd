"use client";

import { useEffect, useState } from "react";

import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { SupportTicketsTable } from "@/components/tickets/support-tickets-table";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { listSupportTickets, type SupportTicketQueue } from "@/lib/support-tickets-api";
import type { SupportTicket } from "@/lib/support-types";

export function SupportTicketsPanel() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<SupportTicketQueue>("escalated");

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      setLoading(true);
      void listSupportTickets({ queue })
        .then((rows) => {
          if (!cancelled) {
            setTickets(rows);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setTickets([]);
            setLoading(false);
          }
        });
    };

    load();
    const poll = window.setInterval(load, 20_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [queue]);

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="Tickets" />
      <StatusFilterSelect
        label="Queue"
        value={queue}
        options={[
          { value: "escalated", label: "Needs an agent" },
          { value: "bot", label: "Handled by Zynd Help Bot" },
        ]}
        onValueChange={(value) => setQueue(value === "bot" ? "bot" : value === "all" ? "all" : "escalated")}
      />

      <SupportTicketsTable tickets={tickets} isLoading={loading} showUserColumn />
    </div>
  );
}
