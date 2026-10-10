"use client";

import { useMemo, useState } from "react";
import { Headset, ScrollText, Ticket, UserRound } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import {
  SupportPageMetricTile,
  SupportPageMetricTilesGrid,
} from "@/components/dashboard/support-page-metric-tile";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { SupportFilterSelect } from "@/components/ui/support-filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
} from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatDistributorDateTime } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import {
  SUPPORT_DUMMY_AUDIT_LOGS,
  type SupportAuditLogEntry,
} from "@/lib/support-audit-logs-dummy-data";
import { cn } from "@/lib/utils";

type ActorRoleFilter = SupportAuditLogEntry["actorRole"] | "all";

const ACTOR_ROLE_OPTIONS: Array<{ value: SupportAuditLogEntry["actorRole"]; label: string }> = [
  { value: "Support Agent", label: "Support Agent" },
  { value: "Support Lead", label: "Support Lead" },
  { value: "System", label: "System" },
];

function actorRoleVariant(role: SupportAuditLogEntry["actorRole"]) {
  if (role === "System") return "info";
  if (role === "Support Lead") return "warning";
  return "neutral";
}

export function SupportAuditLogsPanel() {
  const entries = SUPPORT_DUMMY_AUDIT_LOGS;
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string | "all">("all");
  const [roleFilter, setRoleFilter] = useState<ActorRoleFilter>("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "occurredAt",
    direction: "descending",
  });

  const actionOptions = useMemo(() => {
    const labels = [...new Set(entries.map((entry) => entry.action))].sort((a, b) =>
      a.localeCompare(b),
    );
    return labels.map((label) => ({ value: label, label }));
  }, [entries]);

  const ticketEvents = entries.filter((row) => row.resource.startsWith("TKT-")).length;
  const userEvents = entries.filter((row) => row.resource.startsWith("ZYND-U-")).length;
  const agentEvents = entries.filter((row) => row.actorRole !== "System").length;

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (actionFilter !== "all" && entry.action !== actionFilter) return false;
      if (roleFilter !== "all" && entry.actorRole !== roleFilter) return false;
      return distributorTableSearchMatch(
        search,
        entry.action,
        entry.resource,
        entry.detail,
        entry.actor,
        entry.actorRole,
      );
    });
  }, [actionFilter, entries, roleFilter, search]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const clearDisabled = search.trim() === "" && actionFilter === "all" && roleFilter === "all";

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearch("");
        setActionFilter("all");
        setRoleFilter("all");
        setPage(1);
      }}
      clearDisabled={clearDisabled}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search activity…"
          aria-label="Search activity"
        />
      }
    >
      <SupportFilterSelect
        label="Action"
        value={actionFilter}
        options={actionOptions}
        onValueChange={(value) => {
          setActionFilter(value);
          setPage(1);
        }}
      />
      <SupportFilterSelect
        label="Actor role"
        value={roleFilter}
        options={ACTOR_ROLE_OPTIONS}
        onValueChange={(value) => {
          setRoleFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label="Support activity log"
      className="min-w-[var(--table-min-width-5xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head
          id="occurredAt"
          label="When"
          isRowHeader
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
        <Table.Head id="action" label="Action" allowsSorting />
        <Table.Head id="resource" label="Resource" allowsSorting />
        <Table.Head id="detail" label="Details" />
        <Table.Head id="actor" label="Actor" allowsSorting />
        <Table.Head id="actorRole" label="Role" allowsSorting />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(entry) => (
          <Table.Row id={entry.id}>
            <Table.Cell
              className={cn(
                "whitespace-nowrap tabular-nums text-muted-foreground",
                DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
              )}
            >
              {formatDistributorDateTime(entry.occurredAt)}
            </Table.Cell>
            <Table.Cell className="font-medium text-foreground">{entry.action}</Table.Cell>
            <Table.Cell className="font-mono text-caption text-primary">{entry.resource}</Table.Cell>
            <Table.Cell className="max-w-[22rem] truncate text-muted-foreground">
              {entry.detail}
            </Table.Cell>
            <Table.Cell>{entry.actor}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={actorRoleVariant(entry.actorRole)} showIcon={false}>
                {entry.actorRole}
              </StatusBadge>
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="Activity logs" />

      <SupportPageMetricTilesGrid>
        <SupportPageMetricTile
          tileTone="accent"
          icon={ScrollText}
          label="Events"
          value={String(entries.length)}
        />
        <SupportPageMetricTile
          icon={Headset}
          label="Agent actions"
          value={String(agentEvents)}
        />
        <SupportPageMetricTile
          icon={Ticket}
          label="Ticket events"
          value={String(ticketEvents)}
        />
        <SupportPageMetricTile
          icon={UserRound}
          label="User lookups"
          value={String(userEvents)}
        />
      </SupportPageMetricTilesGrid>

      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle="No activity matches your filters"
        emptyDescription={DISTRIBUTOR_CLIENT_COPY.activity.filtersEmptyDescription}
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
