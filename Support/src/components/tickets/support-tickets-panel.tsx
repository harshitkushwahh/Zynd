"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DUMMY_TICKETS,
  type SupportTicket,
  type SupportTicketStatus,
} from "@/lib/dummy/tickets";
import { getDummyUser } from "@/lib/dummy/users";
import { formatSupportDateTime } from "@/lib/format";
import { labelize, ticketPriorityVariant, ticketStatusVariant } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: Array<"all" | SupportTicketStatus> = ["all", "open", "pending", "resolved"];

export function SupportTicketsPanel() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DUMMY_TICKETS.filter((ticket) => {
      if (status !== "all" && ticket.status !== status) return false;
      if (!q) return true;
      const user = getDummyUser(ticket.userId);
      return (
        ticket.subject.toLowerCase().includes(q) ||
        ticket.id.toLowerCase().includes(q) ||
        user?.name.toLowerCase().includes(q) ||
        user?.email.toLowerCase().includes(q)
      );
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [query, status]);

  const selected = filtered.find((ticket) => ticket.id === selectedId) ??
    DUMMY_TICKETS.find((ticket) => ticket.id === selectedId) ??
    null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-h3 font-semibold text-foreground">Tickets</h1>
        <p className="mt-1 text-caption text-muted-foreground">
          Dummy support queue. Select a ticket to inspect the conversation.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search subject, ticket id, or user…"
          className="sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={status === value ? "default" : "outline"}
              className="capitalize"
              onClick={() => setStatus(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-compact">
              <thead className="border-b border-border bg-muted/30 text-caption text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Assignee</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ticket) => {
                  const user = getDummyUser(ticket.userId);
                  return (
                    <tr
                      key={ticket.id}
                      className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/30"
                      onClick={() => setSelectedId(ticket.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{ticket.subject}</p>
                        <p className="text-caption text-muted-foreground">
                          {ticket.id} · {labelize(ticket.topic)} · {labelize(ticket.channel)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{user?.name ?? "—"}</p>
                        <p className="text-caption text-muted-foreground">{user?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant={ticketStatusVariant(ticket.status)} showIcon={false}>
                          {labelize(ticket.status)}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant={ticketPriorityVariant(ticket.priority)} showIcon={false}>
                          {ticket.priority}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {ticket.assigneeName ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatSupportDateTime(ticket.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-caption text-muted-foreground">
              No tickets match this filter.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <TicketDetailSheet
        ticket={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </div>
  );
}

function TicketDetailSheet({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = ticket ? getDummyUser(ticket.userId) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {ticket ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="shrink-0 border-b border-border px-1 pb-4">
              <SheetTitle className="pr-8 text-left">{ticket.subject}</SheetTitle>
              <SheetDescription className="text-left">
                {ticket.id} · {user?.name ?? "Unknown user"}
              </SheetDescription>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <StatusBadge variant={ticketStatusVariant(ticket.status)} showIcon={false}>
                  {labelize(ticket.status)}
                </StatusBadge>
                <StatusBadge variant={ticketPriorityVariant(ticket.priority)} showIcon={false}>
                  {ticket.priority}
                </StatusBadge>
                <Badge variant="secondary">{labelize(ticket.topic)}</Badge>
                {ticket.attachmentCount > 0 ? (
                  <Badge variant="outline">{ticket.attachmentCount} attachment(s)</Badge>
                ) : null}
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-4">
              <div className="rounded-[var(--radius-card)] border border-border bg-muted/20 px-3 py-2 text-caption text-muted-foreground">
                Assignee: {ticket.assigneeName ?? "Unassigned"} · Updated{" "}
                {formatSupportDateTime(ticket.updatedAt)}
              </div>
              {ticket.messages.map((message) => {
                const isUser = message.role === "user";
                const isSystem = message.role === "system";
                if (isSystem) {
                  return (
                    <p
                      key={message.id}
                      className="text-center text-[11px] text-muted-foreground"
                    >
                      {message.body}
                    </p>
                  );
                }
                return (
                  <div
                    key={message.id}
                    className={cn("flex", isUser ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-compact",
                        isUser
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md border border-border bg-card",
                      )}
                    >
                      {!isUser && message.senderName ? (
                        <p className="mb-1 text-[11px] font-medium opacity-80">
                          {message.senderName}
                        </p>
                      ) : null}
                      <p>{message.body}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          isUser ? "text-primary-foreground/75" : "text-muted-foreground",
                        )}
                      >
                        {formatSupportDateTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
