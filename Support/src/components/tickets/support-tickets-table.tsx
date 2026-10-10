"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import {
  formatTicketPriority,
  formatTicketStatus,
  ticketPriorityVariant,
  ticketStatusVariant,
} from "@/lib/support-ticket-display";
import type { SupportTicket, SupportTicketPriority, SupportTicketStatus } from "@/lib/support-types";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<{ value: SupportTicketStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
];

const PRIORITY_OPTIONS: Array<{ value: SupportTicketPriority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function supportTicketDetailHref(ticketId: string): string {
  return `/dashboard/tickets/${encodeURIComponent(ticketId)}`;
}

type SupportTicketsTableProps = {
  tickets: SupportTicket[];
  showUserColumn?: boolean;
  /** When false, renders the table only (no search, filters, or clear). */
  showToolbar?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

export function SupportTicketsTable({
  tickets,
  showUserColumn = false,
  showToolbar = true,
  emptyTitle,
  emptyDescription,
  className,
}: SupportTicketsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupportTicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<SupportTicketPriority | "all">("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "updatedAt",
    direction: "descending",
  });

  const filtered = useMemo(() => {
    if (!showToolbar) return tickets;
    return tickets.filter((ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false;
      return distributorTableSearchMatch(
        search,
        ticket.id,
        ticket.subject,
        ticket.status,
        ticket.priority,
        ticket.userId,
      );
    });
  }, [priorityFilter, search, showToolbar, statusFilter, tickets]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const openTicket = (ticket: SupportTicket) => {
    router.push(supportTicketDetailHref(ticket.id));
  };

  const toolbar = showToolbar ? (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearch("");
        setStatusFilter("all");
        setPriorityFilter("all");
        setPage(1);
      }}
      clearDisabled={
        search.trim() === "" && statusFilter === "all" && priorityFilter === "all"
      }
      search={
        <DistributorTableSearchCard
          variant="card"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search tickets…"
          aria-label="Search tickets"
        />
      }
    >
      <StatusFilterSelect
        label="Status"
        value={statusFilter}
        options={STATUS_OPTIONS}
        onValueChange={(value) => {
          setStatusFilter(value as SupportTicketStatus | "all");
          setPage(1);
        }}
      />
      <StatusFilterSelect
        label="Priority"
        value={priorityFilter}
        options={PRIORITY_OPTIONS}
        onValueChange={(value) => {
          setPriorityFilter(value as SupportTicketPriority | "all");
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  ) : null;

  const table = wrapDistributorTableBody(
    <Table
      aria-label="Support tickets"
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="id" label="Ticket" isRowHeader allowsSorting />
        <Table.Head id="subject" label="Subject" allowsSorting />
        {showUserColumn ? <Table.Head id="userId" label="User" allowsSorting /> : null}
        <Table.Head id="status" label="Status" allowsSorting />
        <Table.Head id="priority" label="Priority" allowsSorting />
        <Table.Head
          id="updatedAt"
          label="Updated"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(ticket) => (
          <Table.Row id={ticket.id} className="cursor-pointer" onAction={() => openTicket(ticket)}>
            <Table.Cell className="font-mono text-compact text-foreground">{ticket.id}</Table.Cell>
            <Table.Cell className="max-w-[20rem] truncate font-medium text-foreground">
              {ticket.subject}
            </Table.Cell>
            {showUserColumn ? (
              <Table.Cell className="font-mono text-compact text-muted-foreground">
                {ticket.userId}
              </Table.Cell>
            ) : null}
            <Table.Cell>
              <StatusBadge variant={ticketStatusVariant(ticket.status)}>
                {formatTicketStatus(ticket.status)}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell>
              <StatusBadge variant={ticketPriorityVariant(ticket.priority)}>
                {formatTicketPriority(ticket.priority)}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell
              className={cn(
                "whitespace-nowrap tabular-nums text-muted-foreground",
                DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
              )}
            >
              {formatDistributorDate(ticket.updatedAt)}
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <div className={className}>
      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle={emptyTitle ?? (showToolbar ? "No tickets match your filters" : "No other tickets")}
        emptyDescription={
          emptyDescription ??
          (showToolbar ? DISTRIBUTOR_CLIENT_COPY.activity.filtersEmptyDescription : undefined)
        }
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
