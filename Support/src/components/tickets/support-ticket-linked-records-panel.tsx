"use client";

import Link from "next/link";
import { ArrowUpRight, Landmark, ShieldCheck, Ticket, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SupportTicketsTable } from "@/components/tickets/support-tickets-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatTicketStatus, ticketStatusVariant } from "@/lib/support-ticket-display";
import type { SupportTicketLinkedRecord, SupportTicketRelatedRecords } from "@/lib/support-types";
import { cn } from "@/lib/utils";

const RECORD_ICONS: Record<string, LucideIcon> = {
  user: UserRound,
  investment: Landmark,
  kyc: ShieldCheck,
  ticket: Ticket,
};

const RECORD_ID_BADGE_CLASS =
  "inline-flex max-w-full items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 font-mono text-[11px] text-foreground";

type SupportTicketLinkedRecordsPanelProps = {
  related: SupportTicketRelatedRecords;
  className?: string;
};

function recordStatusVariant(record: SupportTicketLinkedRecord) {
  if (record.key === "ticket" && record.statusLabel) {
    return ticketStatusVariant(record.statusLabel as "open" | "pending" | "resolved");
  }
  if (record.statusLabel === "Active" || record.statusLabel === "Verified") {
    return "success";
  }
  if (record.statusLabel === "Not verified" || record.statusLabel === "Restricted") {
    return "destructive";
  }
  return "neutral";
}

function recordStatusLabel(record: SupportTicketLinkedRecord): string | undefined {
  if (!record.statusLabel) return undefined;
  if (record.key === "ticket") {
    return formatTicketStatus(record.statusLabel as "open" | "pending" | "resolved");
  }
  return record.statusLabel;
}

function LinkedRecordOpenIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground shadow-sm transition-colors group-hover:border-primary/40 group-hover:text-primary",
        className,
      )}
      aria-hidden
    >
      <ArrowUpRight className="size-3.5" strokeWidth={2.25} />
    </span>
  );
}

function LinkedRecordCard({ record }: { record: SupportTicketLinkedRecord }) {
  const Icon = RECORD_ICONS[record.key] ?? UserRound;
  const statusLabel = recordStatusLabel(record);
  const statusVariant = recordStatusVariant(record);
  const isCurrentRecord = !record.href;

  const className = cn(
    "group relative flex h-full min-h-[7.25rem] flex-col rounded-lg border border-border/70 bg-card p-3 shadow-sm transition-colors",
    record.href && "hover:border-primary/35 hover:bg-muted/15",
  );

  const content = (
    <>
      <div className="flex items-start gap-2 pr-1">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/30 text-muted-foreground">
          <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />
        </div>
        <p className="min-w-0 flex-1 pt-0.5 text-caption font-semibold leading-tight text-foreground">
          {record.title}
        </p>
        {record.href ? <LinkedRecordOpenIcon /> : null}
      </div>

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
        <span className={cn(RECORD_ID_BADGE_CLASS, "truncate")}>{record.recordId}</span>
        {statusLabel ? (
          <StatusBadge variant={statusVariant} showIcon={false} className="shrink-0 capitalize">
            {statusLabel}
          </StatusBadge>
        ) : null}
        {isCurrentRecord ? (
          <StatusBadge variant="neutral" showIcon={false} className="shrink-0">
            Current record
          </StatusBadge>
        ) : null}
      </div>

      <p className="mt-2 line-clamp-2 flex-1 text-[11px] leading-snug text-muted-foreground">
        {record.description}
      </p>
    </>
  );

  if (record.href) {
    return (
      <Link href={record.href} className={className} aria-label={`Open ${record.title}`}>
        {content}
      </Link>
    );
  }

  return <article className={className}>{content}</article>;
}

export function SupportTicketLinkedRecordsPanel({
  related,
  className,
}: SupportTicketLinkedRecordsPanelProps) {
  return (
    <Card className={cn("flex h-full min-h-0 flex-col overflow-hidden shadow-sm", className)}>
      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-4">
          {related.records.map((record) => (
            <LinkedRecordCard key={record.key} record={record} />
          ))}
        </div>

        <section className="min-w-0">
          <SupportTicketsTable
            tickets={related.recentTickets}
            showToolbar={false}
            emptyTitle="No other tickets for this investor"
          />
        </section>
      </CardContent>
    </Card>
  );
}
