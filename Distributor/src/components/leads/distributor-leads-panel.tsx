"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorPageShell } from "@/components/dashboard/distributor-page-shell";
import { useDistributorScopePageReveal } from "@/components/dashboard/use-distributor-scope-page-reveal";
import { DistributorLeadsPageSkeleton } from "@/components/leads/distributor-leads-page-skeleton";
import { DistributorLeadsSectionMetrics } from "@/components/leads/distributor-leads-section-metrics";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import {
  DISTRIBUTOR_LEAD_SOURCE_OPTIONS,
  DUMMY_DISTRIBUTOR_LEADS,
  type DistributorLeadRow,
  type DistributorLeadSource,
  type DistributorLeadStage,
} from "@/lib/dummy/distributor-leads";
import { distributorClientDetailHref } from "@/lib/distributor-client-routes";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

const STAGE_OPTIONS: Array<{ value: DistributorLeadStage; label: string }> = [
  { value: "Invited", label: "Invited" },
  { value: "KYC started", label: "KYC started" },
  { value: "KYC dropped", label: "KYC dropped" },
  { value: "Ready to invest", label: "Ready to invest" },
  { value: "First investment", label: "First investment" },
];

function stageVariant(stage: DistributorLeadStage): StatusBadgeVariant {
  if (stage === "First investment") return "success";
  if (stage === "Ready to invest") return "info";
  if (stage === "KYC dropped") return "destructive";
  if (stage === "KYC started") return "warning";
  return "neutral";
}

type DistributorLeadsPanelProps = DistributorPageConfig;

export function DistributorLeadsPanel({ title, description }: DistributorLeadsPanelProps) {
  const { showSkeleton } = useDistributorScopePageReveal();
  const rows = DUMMY_DISTRIBUTOR_LEADS;
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<DistributorLeadStage | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<DistributorLeadSource | "all">("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "lastActivityAt",
    direction: "descending",
  });

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (stageFilter !== "all" && row.stage !== stageFilter) return false;
      if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
      return distributorTableSearchMatch(
        searchQuery,
        row.clientCode,
        row.clientLabel,
        row.emailMasked,
        row.stage,
        row.source,
      );
    });
  }, [rows, searchQuery, sourceFilter, stageFilter]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const metrics = <DistributorLeadsSectionMetrics rows={rows} />;

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setStageFilter("all");
        setSourceFilter("all");
        setPage(1);
      }}
      clearDisabled={stageFilter === "all" && sourceFilter === "all" && searchQuery.trim() === ""}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search leads…"
          aria-label="Search leads"
        />
      }
    >
      <StatusFilterSelect
        label="Stage"
        value={stageFilter}
        options={STAGE_OPTIONS}
        onValueChange={(value) => {
          setStageFilter(value);
          setPage(1);
        }}
      />
      <StatusFilterSelect
        label="Source"
        value={sourceFilter}
        options={DISTRIBUTOR_LEAD_SOURCE_OPTIONS}
        onValueChange={(value) => {
          setSourceFilter(value);
          setPage(1);
        }}
      />
      <DistributorActionButton
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        aria-label="Download leads as Excel"
      >
        <Download className="size-3.5" aria-hidden />
        Excel
      </DistributorActionButton>
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label="Onboarding leads"
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="clientCode" label="Prospect" isRowHeader allowsSorting />
        <Table.Head id="emailMasked" label="Email" allowsSorting />
        <Table.Head id="stage" label="Stage" allowsSorting />
        <Table.Head id="source" label="Source" allowsSorting />
        <Table.Head id="daysInStage" label="Days in stage" allowsSorting className="text-right [&>div]:justify-end" />
        <Table.Head
          id="lastActivityAt"
          label="Last activity"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(row: DistributorLeadRow) => (
          <Table.Row id={row.id}>
            <Table.Cell>
              <Link
                href={distributorClientDetailHref("your-book", row.clientId)}
                className="font-medium hover:underline"
              >
                {row.clientLabel}
              </Link>
              <p className="font-mono text-caption text-muted-foreground">{row.clientCode}</p>
            </Table.Cell>
            <Table.Cell className="text-muted-foreground">{row.emailMasked}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={stageVariant(row.stage)}>{row.stage}</StatusBadge>
            </Table.Cell>
            <Table.Cell>{row.source}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{row.daysInStage}</Table.Cell>
            <Table.Cell className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}>
              {formatDistributorDate(row.lastActivityAt)}
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  if (showSkeleton) {
    return <DistributorLeadsPageSkeleton />;
  }

  return (
    <div className={cn("distributor-scope-page--enter", "w-full min-w-0")}>
      <DistributorPageShell
        title={title}
        description={description}
        metrics={metrics}
        toolbar={toolbar}
        isEmpty={pageItems.length === 0}
        emptyTitle="No leads in pipeline"
        emptyDescription="Invite investors to start building your onboarding funnel."
      >
        {table}
      </DistributorPageShell>
    </div>
  );
}
