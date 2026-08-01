"use client";

import { useMemo, useState } from "react";
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
import type { DistributorClientKycAuditEntry } from "@/lib/dummy/types";
import { formatDistributorDateTime } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";

type ClientKycAuditLogPanelProps = {
  entries: DistributorClientKycAuditEntry[];
  className?: string;
};

type AuditActionFilter = string;

function actorLabel(
  actor: DistributorClientKycAuditEntry["actor"],
  copy: (typeof DISTRIBUTOR_CLIENT_COPY)["kyc"],
): string {
  return actor === "system" ? copy.auditLogActorSystem : copy.auditLogActorInvestor;
}

function actorVariant(actor: DistributorClientKycAuditEntry["actor"]): "info" | "neutral" {
  return actor === "system" ? "info" : "neutral";
}

export function ClientKycAuditLogPanel({ entries, className }: ClientKycAuditLogPanelProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditActionFilter | "all">("all");
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

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (actionFilter !== "all" && entry.action !== actionFilter) return false;
      return distributorTableSearchMatch(
        search,
        entry.action,
        entry.stepLabel ?? "",
        entry.detail,
        entry.source,
        actorLabel(entry.actor, copy),
      );
    });
  }, [actionFilter, copy, entries, search]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearch("");
        setActionFilter("all");
        setPage(1);
      }}
      clearDisabled={search.trim() === "" && actionFilter === "all"}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder={copy.auditLogSearchPlaceholder}
          aria-label={copy.auditLogSearchPlaceholder}
        />
      }
    >
      <StatusFilterSelect
        label={copy.auditLogActionFilterLabel}
        value={actionFilter}
        options={actionOptions}
        onValueChange={(value) => {
          setActionFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label={copy.auditLogTitle}
      className="min-w-[var(--table-min-width-3xl)]"
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
          label={copy.auditLogColumnWhen}
          isRowHeader
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
        <Table.Head id="action" label={copy.auditLogColumnAction} allowsSorting />
        <Table.Head id="stepLabel" label={copy.auditLogColumnStep} allowsSorting />
        <Table.Head id="detail" label={copy.auditLogColumnDetail} />
        <Table.Head id="actor" label={copy.auditLogColumnActor} allowsSorting />
        <Table.Head id="source" label={copy.auditLogColumnSource} allowsSorting />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(entry) => (
          <Table.Row id={entry.id}>
            <Table.Cell className={cn("whitespace-nowrap tabular-nums text-muted-foreground")}>
              {formatDistributorDateTime(entry.occurredAt)}
            </Table.Cell>
            <Table.Cell className="font-medium text-foreground">{entry.action}</Table.Cell>
            <Table.Cell className="text-muted-foreground">
              {entry.stepLabel ?? copy.auditLogStepNone}
            </Table.Cell>
            <Table.Cell className="max-w-[22rem] text-muted-foreground">{entry.detail}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={actorVariant(entry.actor)}>
                {actorLabel(entry.actor, copy)}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell className="whitespace-nowrap text-muted-foreground">{entry.source}</Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <section className={cn("distributor-client-kyc-audit-log", className)}>
      <header className="distributor-client-kyc-audit-log__header">
        <h2 className="distributor-client-kyc-audit-log__title">{copy.auditLogTitle}</h2>
      </header>
      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle={entries.length === 0 ? copy.auditLogEmpty : copy.auditLogEmptyFiltered}
        emptyDescription={DISTRIBUTOR_CLIENT_COPY.activity.filtersEmptyDescription}
      >
        {table}
      </DistributorTableOnlyShell>
    </section>
  );
}
