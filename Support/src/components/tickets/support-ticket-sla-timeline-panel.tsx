"use client";

import { Table } from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { SupportSlaHorizontalTimeline } from "@/components/tickets/support-sla-horizontal-timeline";
import { SupportSlaRingGauge } from "@/components/tickets/support-sla-ring-gauge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import { SupportFilterSelect } from "@/components/ui/support-filter-select";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import type { SupportSlaEventRowStatus, SupportTicketSlaTabData } from "@/lib/support-types";
import { cn } from "@/lib/utils";

function eventStatusVariant(status: SupportSlaEventRowStatus): StatusBadgeVariant {
  if (status === "completed") return "success";
  if (status === "pending") return "info";
  return "neutral";
}

function eventStatusLabel(status: SupportSlaEventRowStatus): string {
  if (status === "completed") return "Completed";
  if (status === "pending") return "Pending";
  return "Upcoming";
}

type SupportTicketSlaTimelinePanelProps = {
  slaTab: SupportTicketSlaTabData;
  className?: string;
};

export function SupportTicketSlaTimelinePanel({
  slaTab,
  className,
}: SupportTicketSlaTimelinePanelProps) {
  const table = wrapDistributorTableBody(
    <Table aria-label="SLA events" className="min-w-[var(--table-min-width-3xl)]">
      <Table.Header>
        <Table.Head id="index" label="#" isRowHeader className="w-10" />
        <Table.Head id="event" label="Event" />
        <Table.Head id="expectedTime" label="Expected time" />
        <Table.Head id="actualTime" label="Actual time" />
        <Table.Head id="status" label="Status" />
        <Table.Head id="remarks" label="Remarks" className="min-w-[12rem]" />
      </Table.Header>
      <Table.Body items={slaTab.events}>
        {(row) => (
          <Table.Row id={row.id}>
            <Table.Cell className="tabular-nums text-muted-foreground">{row.index}</Table.Cell>
            <Table.Cell className="font-medium">{row.event}</Table.Cell>
            <Table.Cell className="whitespace-nowrap text-muted-foreground">{row.expectedTime}</Table.Cell>
            <Table.Cell className="whitespace-nowrap text-muted-foreground">{row.actualTime}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={eventStatusVariant(row.status)}>
                {eventStatusLabel(row.status)}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell className="text-muted-foreground">{row.remarks}</Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <Card className={cn("flex h-full min-h-0 flex-col overflow-hidden shadow-sm", className)}>
      <CardContent className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-compact font-semibold text-foreground">SLA overview</h2>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant="destructive">{slaTab.priorityLabel}</StatusBadge>
              <SupportFilterSelect
                label="SLA policy"
                value={slaTab.policyName}
                options={[{ value: slaTab.policyName, label: slaTab.policyName }]}
                onValueChange={() => {}}
                showAllOption={false}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {slaTab.overview.map((gauge) => (
              <SupportSlaRingGauge
                key={gauge.id}
                title={gauge.title}
                centerPrimary={gauge.centerPrimary}
                centerSecondary={gauge.centerSecondary}
                progressPct={gauge.progressPct}
                ringFill={gauge.ringFill}
                targetLabel={gauge.targetLabel}
                statusVariant={gauge.statusVariant}
                statusLabel={gauge.statusLabel}
                footnote={gauge.footnote}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-compact font-semibold text-foreground">SLA timeline</h2>
          <div className="rounded-[var(--radius-card)] border border-border/70 bg-muted/10 px-4 py-5">
            <SupportSlaHorizontalTimeline steps={slaTab.steps} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-compact font-semibold text-foreground">SLA events</h2>
          <DistributorTableOnlyShell
            isEmpty={slaTab.events.length === 0}
            emptyTitle="No SLA events"
            tableSize="md"
          >
            {table}
          </DistributorTableOnlyShell>
        </section>

      </CardContent>
    </Card>
  );
}
