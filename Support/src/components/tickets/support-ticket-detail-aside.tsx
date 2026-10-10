"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  FileText,
  Mail,
  Phone,
  Ticket,
  UserRound,
} from "lucide-react";

import { SupportTicketDetailField } from "@/components/tickets/support-ticket-detail-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDisplayInitials } from "@/lib/get-display-initials";
import {
  formatTicketPriority,
  formatTicketStatus,
  ticketPriorityVariant,
  ticketStatusVariant,
} from "@/lib/support-ticket-display";
import type { SupportTicketDetail } from "@/lib/support-types";
import { cn } from "@/lib/utils";

type SupportTicketDetailAsideProps = {
  detail: SupportTicketDetail;
  className?: string;
};

function AsideCard({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: typeof UserRound;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("distributor-panel-card", className)}>
      <div className="distributor-panel-card__header">
        <div className="distributor-panel-card__header-row">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.25} aria-hidden />
            <h2 className="text-compact font-semibold text-foreground">{title}</h2>
          </div>
          {action}
        </div>
      </div>
      <div className="distributor-panel-card__body">{children}</div>
    </section>
  );
}

export function SupportTicketDetailAside({ detail, className }: SupportTicketDetailAsideProps) {
  const { ticket, customer, domain, sidebarMeta } = detail;
  const userHref = `/dashboard/users/${encodeURIComponent(ticket.userId)}`;
  const initials = getDisplayInitials(customer.displayName);
  const kycBadgeVariant = customer.kycCompliant ? "success" : "destructive";

  return (
    <aside
      className={cn(
        "flex min-h-0 w-full flex-col gap-3 overflow-y-auto overscroll-contain [scrollbar-width:thin] lg:max-w-[20rem] lg:shrink-0",
        className,
      )}
    >
      <AsideCard title="Customer" icon={UserRound}>
        <div className="flex items-start gap-3">
          <Avatar className="size-12 border border-border/80">
            <AvatarFallback className="bg-primary/10 text-caption font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <Link href={userHref} className="block truncate font-medium text-foreground hover:text-primary">
              {customer.displayName}
            </Link>
            <div className="mt-2 space-y-1.5 text-caption text-muted-foreground">
              <p className="flex items-center gap-2">
                <Phone className="size-3.5 shrink-0" aria-hidden />
                {customer.mobileMasked}
              </p>
              <p className="flex items-center gap-2 truncate">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                {customer.emailMasked}
              </p>
            </div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <SupportTicketDetailField label="PAN">{customer.panMasked}</SupportTicketDetailField>
          <SupportTicketDetailField label="Client type">{customer.clientType}</SupportTicketDetailField>
          <SupportTicketDetailField label="KYC status">
            <StatusBadge variant={kycBadgeVariant}>{customer.kycStatusLabel}</StatusBadge>
          </SupportTicketDetailField>
        </dl>
      </AsideCard>

      {domain ? (
        <AsideCard
          title={domain.title}
          icon={FileText}
          action={
            domain.viewInHref ? (
              <Link
                href={domain.viewInHref}
                className="distributor-operations-team-card__nav"
                aria-label={domain.viewInLabel ?? "View linked record"}
              >
                <ArrowUpRight className="size-4" strokeWidth={2.25} aria-hidden />
              </Link>
            ) : null
          }
        >
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            {domain.fields.map((field) => (
              <SupportTicketDetailField key={field.label} label={field.label}>
                {field.value}
              </SupportTicketDetailField>
            ))}
          </dl>
          <div className="mt-4">
            <StatusBadge variant={domain.statusVariant ?? "warning"}>
              {domain.statusLabel}
            </StatusBadge>
          </div>
        </AsideCard>
      ) : null}

      <AsideCard title="Ticket information" icon={Ticket}>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <SupportTicketDetailField label="Type">{sidebarMeta.typeLabel}</SupportTicketDetailField>
          <SupportTicketDetailField label="Priority">
            <StatusBadge variant={ticketPriorityVariant(ticket.priority)} showIcon={false}>
              {formatTicketPriority(ticket.priority)}
            </StatusBadge>
          </SupportTicketDetailField>
          <SupportTicketDetailField label="Status">
            <StatusBadge variant={ticketStatusVariant(ticket.status)} showIcon={false}>
              {formatTicketStatus(ticket.status)}
            </StatusBadge>
          </SupportTicketDetailField>
          <SupportTicketDetailField label="Assigned to">{sidebarMeta.assignedTo}</SupportTicketDetailField>
          <SupportTicketDetailField label="Team">{sidebarMeta.teamLabel}</SupportTicketDetailField>
          <SupportTicketDetailField label="Created on">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden />
              {sidebarMeta.createdOn}
            </span>
          </SupportTicketDetailField>
          <SupportTicketDetailField label="Last updated">{sidebarMeta.lastUpdated}</SupportTicketDetailField>
        </dl>
      </AsideCard>
    </aside>
  );
}
