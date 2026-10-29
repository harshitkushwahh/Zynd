"use client";

import { MoreHorizontal, Pencil, UserPlus } from "lucide-react";

import { SupportTicketIdCopyBadge } from "@/components/tickets/support-ticket-id-copy-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatTicketPriority,
  formatTicketStatus,
  formatTicketTopicLabel,
  ticketPriorityVariant,
  ticketStatusVariant,
} from "@/lib/support-ticket-display";
import type { SupportTicketDetail } from "@/lib/support-types";

type SupportTicketDetailHeaderProps = {
  detail: SupportTicketDetail;
  canManage?: boolean;
  onAssign?: () => void;
  onSetStatus?: (status: SupportTicketDetail["ticket"]["status"]) => void;
};

/** Match distributor toolbar controls  modest radius, not pill-shaped. */
const HEADER_ACTION_BUTTON_CLASS = "rounded-md";

export function SupportTicketDetailHeader({
  detail,
  canManage = false,
  onAssign,
  onSetStatus,
}: SupportTicketDetailHeaderProps) {
  const { ticket, sidebarMeta } = detail;

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-heading text-h3 font-semibold leading-tight text-foreground">
            {ticket.subject}
          </h1>
          <SupportTicketIdCopyBadge ticketId={ticket.id} className="shrink-0" />
          <StatusBadge variant={ticketPriorityVariant(ticket.priority)}>
            {formatTicketPriority(ticket.priority)}
          </StatusBadge>
          <StatusBadge variant={ticketStatusVariant(ticket.status)}>
            {formatTicketStatus(ticket.status)}
          </StatusBadge>
          <StatusBadge variant="neutral" showIcon={false}>
            {formatTicketTopicLabel(ticket.topic)}
          </StatusBadge>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    disabled={!canManage}
                    className={HEADER_ACTION_BUTTON_CLASS}
                  >
                    <Pencil className="size-3.5" strokeWidth={2.25} aria-hidden />
                    Edit
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={!canManage} onClick={() => onSetStatus?.("open")}>
                  Mark open
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!canManage} onClick={() => onSetStatus?.("pending")}>
                  Mark pending
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!canManage} onClick={() => onSetStatus?.("resolved")}>
                  Mark resolved
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="default"
              disabled={!canManage}
              className={HEADER_ACTION_BUTTON_CLASS}
              onClick={onAssign}
            >
              <UserPlus className="size-3.5" strokeWidth={2.25} aria-hidden />
              Assign
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={HEADER_ACTION_BUTTON_CLASS}
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="size-4" strokeWidth={2.25} />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>Merge ticket</DropdownMenuItem>
                <DropdownMenuItem disabled>Mark spam</DropdownMenuItem>
                <DropdownMenuItem disabled>Export transcript</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-caption text-muted-foreground">
        <p>
          <span className="font-medium text-foreground/80">Created on</span> {sidebarMeta.createdOn}
        </p>
        <p>
          <span className="font-medium text-foreground/80">Last updated</span>{" "}
          {sidebarMeta.lastUpdated}
        </p>
      </div>
    </header>
  );
}
