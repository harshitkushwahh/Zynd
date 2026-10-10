"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Bell, Server, Webhook } from "lucide-react";
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
  SUPPORT_DUMMY_SYSTEM_LOGS,
  type SupportSystemLogLevel,
} from "@/lib/support-system-logs-dummy-data";
import { cn } from "@/lib/utils";

const LEVEL_OPTIONS: Array<{ value: SupportSystemLogLevel; label: string }> = [
  { value: "Info", label: "Info" },
  { value: "Warning", label: "Warning" },
  { value: "Error", label: "Error" },
];

function logLevelVariant(level: SupportSystemLogLevel) {
  if (level === "Error") return "destructive";
  if (level === "Warning") return "warning";
  return "info";
}

export function SupportSystemLogsPanel() {
  const entries = SUPPORT_DUMMY_SYSTEM_LOGS;
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<SupportSystemLogLevel | "all">("all");
  const [serviceFilter, setServiceFilter] = useState<string | "all">("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "occurredAt",
    direction: "descending",
  });

  const serviceOptions = useMemo(() => {
    const labels = [...new Set(entries.map((entry) => entry.service))].sort((a, b) =>
      a.localeCompare(b),
    );
    return labels.map((label) => ({ value: label, label }));
  }, [entries]);

  const errorCount = entries.filter((row) => row.level === "Error").length;
  const warningCount = entries.filter((row) => row.level === "Warning").length;
  const webhookCount = entries.filter((row) => row.service.toLowerCase().includes("webhook")).length;

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (levelFilter !== "all" && entry.level !== levelFilter) return false;
      if (serviceFilter !== "all" && entry.service !== serviceFilter) return false;
      return distributorTableSearchMatch(
        search,
        entry.level,
        entry.service,
        entry.event,
        entry.detail,
        entry.correlationId,
      );
    });
  }, [entries, levelFilter, search, serviceFilter]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const clearDisabled = search.trim() === "" && levelFilter === "all" && serviceFilter === "all";

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearch("");
        setLevelFilter("all");
        setServiceFilter("all");
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
          placeholder="Search system logs…"
          aria-label="Search system logs"
        />
      }
    >
      <SupportFilterSelect
        label="Level"
        value={levelFilter}
        options={LEVEL_OPTIONS}
        onValueChange={(value) => {
          setLevelFilter(value);
          setPage(1);
        }}
      />
      <SupportFilterSelect
        label="Service"
        value={serviceFilter}
        options={serviceOptions}
        onValueChange={(value) => {
          setServiceFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label="System logs"
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
        <Table.Head id="level" label="Level" allowsSorting />
        <Table.Head id="service" label="Service" allowsSorting />
        <Table.Head id="event" label="Event" allowsSorting />
        <Table.Head id="detail" label="Details" />
        <Table.Head id="correlationId" label="Reference" allowsSorting />
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
            <Table.Cell>
              <StatusBadge variant={logLevelVariant(entry.level)} showIcon={false}>
                {entry.level}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell className="font-medium text-foreground">{entry.service}</Table.Cell>
            <Table.Cell className="font-mono text-caption text-muted-foreground">{entry.event}</Table.Cell>
            <Table.Cell className="max-w-[20rem] truncate text-muted-foreground">
              {entry.detail}
            </Table.Cell>
            <Table.Cell className="font-mono text-caption text-primary">{entry.correlationId}</Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="System logs" />

      <SupportPageMetricTilesGrid>
        <SupportPageMetricTile
          tileTone="accent"
          icon={Server}
          label="Events"
          value={String(entries.length)}
        />
        <SupportPageMetricTile
          icon={AlertCircle}
          label="Errors"
          value={String(errorCount)}
        />
        <SupportPageMetricTile
          icon={Bell}
          label="Warnings"
          value={String(warningCount)}
        />
        <SupportPageMetricTile
          icon={Webhook}
          label="Webhooks"
          value={String(webhookCount)}
        />
      </SupportPageMetricTilesGrid>

      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle="No system logs match your filters"
        emptyDescription={DISTRIBUTOR_CLIENT_COPY.activity.filtersEmptyDescription}
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
