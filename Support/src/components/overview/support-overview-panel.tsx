"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, Headset, Ticket } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DUMMY_TICKETS } from "@/lib/dummy/tickets";
import { getDummyUser } from "@/lib/dummy/users";
import { formatSupportDateTime } from "@/lib/format";
import { labelize, ticketPriorityVariant, ticketStatusVariant } from "@/lib/status-meta";

const openCount = DUMMY_TICKETS.filter((ticket) => ticket.status === "open").length;
const pendingCount = DUMMY_TICKETS.filter((ticket) => ticket.status === "pending").length;
const resolvedCount = DUMMY_TICKETS.filter((ticket) => ticket.status === "resolved").length;
const recentTickets = [...DUMMY_TICKETS]
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  .slice(0, 5);

export function SupportOverviewPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-h3 font-semibold text-foreground">Overview</h1>
        <p className="mt-1 text-caption text-muted-foreground">
          Dummy queue health for the contact team — backend wiring comes later.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Ticket}
          label="Open tickets"
          value={String(openCount)}
          hint={`${pendingCount} pending`}
        />
        <MetricCard
          icon={Clock3}
          label="Avg first response"
          value="12m"
          hint="Demo estimate"
        />
        <MetricCard
          icon={Headset}
          label="Active agents"
          value="2"
          hint="Aanya · Rahul"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Resolved"
          value={String(resolvedCount)}
          hint="Closed in demo data"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-body">Recent tickets</CardTitle>
          <Link href="/dashboard/tickets" className="text-caption text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="space-y-2 p-0 px-4 pb-4">
          {recentTickets.map((ticket) => {
            const user = getDummyUser(ticket.userId);
            return (
              <Link
                key={ticket.id}
                href="/dashboard/tickets"
                className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-border/70 px-3 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-compact font-medium text-foreground">
                    {ticket.subject}
                  </p>
                  <p className="mt-0.5 truncate text-caption text-muted-foreground">
                    {ticket.id} · {user?.name ?? "Unknown"} · {formatSupportDateTime(ticket.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge variant={ticketStatusVariant(ticket.status)} showIcon={false}>
                    {labelize(ticket.status)}
                  </StatusBadge>
                  <StatusBadge variant={ticketPriorityVariant(ticket.priority)} showIcon={false}>
                    {ticket.priority}
                  </StatusBadge>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Ticket;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-caption text-muted-foreground">{label}</p>
          <p className="mt-1 font-heading text-h4 font-semibold tabular-nums">{value}</p>
          <p className="mt-1 text-caption text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
