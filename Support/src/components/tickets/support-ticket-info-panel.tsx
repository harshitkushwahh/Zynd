"use client";

import { useCallback, useState } from "react";
import { CalendarClock, Download, Eye, FileText, UserRound } from "lucide-react";

import { SupportTicketDetailField } from "@/components/tickets/support-ticket-detail-field";
import { SupportTicketIdCopyBadge } from "@/components/tickets/support-ticket-id-copy-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_LABEL_CAPS_TINY_CLASS } from "@/lib/distributor-layout";
import { formatDistributorDateTime } from "@/lib/format";
import {
  formatTicketChannel,
  formatTicketPriority,
  formatTicketStatus,
  formatTicketTopic,
  ticketPriorityVariant,
  ticketStatusVariant,
} from "@/lib/support-ticket-display";
import type { SupportTicket, SupportTicketAttachment } from "@/lib/support-types";
import { cn } from "@/lib/utils";

function downloadTicketAttachment(attachment: SupportTicketAttachment) {
  const blob = new Blob([`Attachment: ${attachment.fileName}`], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = attachment.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function TicketAttachmentRow({ attachment }: { attachment: SupportTicketAttachment }) {
  const [viewOpen, setViewOpen] = useState(false);

  const onDownload = useCallback(() => {
    downloadTicketAttachment(attachment);
  }, [attachment]);

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/30 text-muted-foreground">
            <FileText className="size-4" strokeWidth={2.25} aria-hidden />
          </div>
          <p className="truncate text-compact font-medium text-foreground">{attachment.fileName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            aria-label={`View ${attachment.fileName}`}
            onClick={() => setViewOpen(true)}
          >
            <Eye className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            aria-label={`Download ${attachment.fileName}`}
            onClick={onDownload}
          >
            <Download className="size-4" strokeWidth={2.25} />
          </Button>
        </div>
      </div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogHeader className="sr-only">
          <DialogTitle>{attachment.fileName}</DialogTitle>
          <DialogDescription>Ticket attachment preview</DialogDescription>
        </DialogHeader>
        <DialogContent className="max-w-md gap-0 p-0">
          <div className="border-b border-border/60 px-5 py-4">
            <p className="font-heading text-body font-semibold text-foreground">{attachment.fileName}</p>
            {attachment.uploadedAt ? (
              <p className="mt-1 text-caption text-muted-foreground">
                Uploaded {formatDistributorDateTime(attachment.uploadedAt)}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-center px-6 py-14">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/15 text-muted-foreground">
              <FileText className="size-8" strokeWidth={1.75} aria-hidden />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type SupportTicketInfoPanelProps = {
  ticket: SupportTicket;
  slaLabel: string;
  className?: string;
};

export function SupportTicketInfoPanel({
  ticket,
  slaLabel,
  className,
}: SupportTicketInfoPanelProps) {
  const slaVariant =
    ticket.status === "resolved" ? "success" : slaLabel.toLowerCase().includes("breach") ? "destructive" : "warning";

  return (
    <Card className={cn("flex h-full min-h-0 flex-col overflow-hidden shadow-sm", className)}>
      <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
        <div className="border-b border-border/60 bg-muted/15 px-6 py-5">
          <SupportTicketIdCopyBadge ticketId={ticket.id} />
          <h2 className="mt-3 font-heading text-h3 font-semibold leading-snug text-foreground">
            {ticket.subject}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge variant={ticketStatusVariant(ticket.status)}>
              {formatTicketStatus(ticket.status)}
            </StatusBadge>
            <StatusBadge variant={ticketPriorityVariant(ticket.priority)}>
              {formatTicketPriority(ticket.priority)}
            </StatusBadge>
            <StatusBadge variant="neutral" showIcon={false} className="capitalize">
              {formatTicketTopic(ticket.topic)}
            </StatusBadge>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section>
            <h3 className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>Description</h3>
            <p className="mt-3 rounded-xl border border-border/60 bg-card px-4 py-3.5 text-compact leading-relaxed text-foreground">
              {ticket.description}
            </p>
          </section>

          <section className="overflow-hidden rounded-xl border border-border/60 bg-muted/10">
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <h3 className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>Classification</h3>
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                <SupportTicketDetailField label="Type">
                  <span className="capitalize">{formatTicketTopic(ticket.topic)}</span>
                </SupportTicketDetailField>
                <SupportTicketDetailField label="Channel">
                  {formatTicketChannel(ticket.channel)}
                </SupportTicketDetailField>
                <SupportTicketDetailField label="Priority">
                  <StatusBadge variant={ticketPriorityVariant(ticket.priority)}>
                    {formatTicketPriority(ticket.priority)}
                  </StatusBadge>
                </SupportTicketDetailField>
                <SupportTicketDetailField label="Status">
                  <StatusBadge variant={ticketStatusVariant(ticket.status)}>
                    {formatTicketStatus(ticket.status)}
                  </StatusBadge>
                </SupportTicketDetailField>
              </dl>
            </div>

            <div className="border-t border-border/60 px-4 py-4 sm:px-5 sm:py-5">
              <h3 className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>Ownership & SLA</h3>
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                <SupportTicketDetailField label="Assignee">
                  <span className="inline-flex items-center gap-2">
                    <UserRound className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2.25} aria-hidden />
                    {ticket.assigneeName ?? "Unassigned"}
                  </span>
                </SupportTicketDetailField>
                <SupportTicketDetailField label="SLA">
                  <StatusBadge variant={slaVariant}>{slaLabel}</StatusBadge>
                </SupportTicketDetailField>
              </dl>
            </div>

            <div className="border-t border-border/60 px-4 py-4 sm:px-5 sm:py-5">
              <h3 className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>Timeline</h3>
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                <SupportTicketDetailField label="Created">
                  <span className="inline-flex items-center gap-2 tabular-nums">
                    <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2.25} aria-hidden />
                    {formatDistributorDateTime(ticket.createdAt)}
                  </span>
                </SupportTicketDetailField>
                <SupportTicketDetailField label="Updated">
                  <span className="inline-flex items-center gap-2 tabular-nums">
                    <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2.25} aria-hidden />
                    {formatDistributorDateTime(ticket.updatedAt)}
                  </span>
                </SupportTicketDetailField>
              </dl>
            </div>
          </section>

          <section>
            <h3 className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>Attachments</h3>
            {ticket.attachments.length > 0 ? (
              <div className="mt-3 space-y-2">
                {ticket.attachments.map((attachment) => (
                  <TicketAttachmentRow key={attachment.id} attachment={attachment} />
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-3 text-caption text-muted-foreground">
                No attachments on this ticket.
              </p>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
