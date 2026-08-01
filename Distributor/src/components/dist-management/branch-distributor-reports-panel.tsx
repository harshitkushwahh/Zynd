"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, LineChart, TrendingDown, TrendingUp } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import {
  BranchDistributorSquareCardGrid,
  BranchDistributorSquareMetricCard,
} from "@/components/dist-management/branch-distributor-square-card";
import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { DistributorReportTemplateCard } from "@/components/reports/distributor-report-template-card";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { Card } from "@/components/ui/card";
import { DistributorChartTooltip } from "@/components/ui/distributor-chart-tooltip";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { BranchDistributorProfile } from "@/lib/dummy/branch-distributor-profile";
import {
  getBranchComplianceExceptionsForDistributor,
  getBranchDistributorReportTemplates,
  getBranchKycPendingForDistributor,
  getBranchReportRollupForDistributor,
  getBranchReportTrendForDistributor,
} from "@/lib/dummy/branch-distributor-ops-data";
import type {
  BranchComplianceException,
  BranchKycPendingRow,
} from "@/lib/dummy/branch-reports";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

const CHART_HEIGHT = 240;

type ReportTableRow =
  | ({ kind: "kyc" } & BranchKycPendingRow)
  | ({ kind: "exception" } & BranchComplianceException);

function exceptionStatusVariant(status: BranchComplianceException["status"]): StatusBadgeVariant {
  if (status === "Resolved") return "success";
  if (status === "In review") return "info";
  return "warning";
}

function RollupTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const aum = Number(payload.find((p) => p.dataKey === "aum")?.value ?? 0);
  const netSales = Number(payload.find((p) => p.dataKey === "netSales")?.value ?? 0);
  return (
    <DistributorChartTooltip>
      <p className="text-caption font-medium text-foreground">{label}</p>
      <p className="mt-1 text-caption text-muted-foreground">AUM {formatAum(aum)}</p>
      <p className="text-caption text-muted-foreground">Net sales {formatAum(netSales)}</p>
    </DistributorChartTooltip>
  );
}

function renderRollupTooltip(props: unknown) {
  return <RollupTooltip {...(props as Parameters<typeof RollupTooltip>[0])} />;
}

type BranchDistributorReportsPanelProps = {
  profile: BranchDistributorProfile;
  className?: string;
};

export function BranchDistributorReportsPanel({
  profile,
  className,
}: BranchDistributorReportsPanelProps) {
  const rollup = useMemo(
    () => getBranchReportRollupForDistributor(profile.id),
    [profile.id],
  );
  const trend = useMemo(
    () => getBranchReportTrendForDistributor(profile.id),
    [profile.id],
  );
  const kycRows = useMemo(
    () => getBranchKycPendingForDistributor(profile),
    [profile],
  );
  const exceptionRows = useMemo(
    () => getBranchComplianceExceptionsForDistributor(profile),
    [profile],
  );
  const reportTemplates = useMemo(
    () => getBranchDistributorReportTemplates(profile.id),
    [profile.id],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [rowFilter, setRowFilter] = useState<"all" | "kyc" | "exception">("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "daysOpen",
    direction: "descending",
  });

  const combinedRows = useMemo((): ReportTableRow[] => {
    const kyc = kycRows.map((row) => ({ kind: "kyc" as const, ...row }));
    const exceptions = exceptionRows.map((row) => ({ kind: "exception" as const, ...row }));
    return [...kyc, ...exceptions];
  }, [exceptionRows, kycRows]);

  const filtered = useMemo(() => {
    return combinedRows.filter((row) => {
      if (rowFilter === "kyc" && row.kind !== "kyc") return false;
      if (rowFilter === "exception" && row.kind !== "exception") return false;
      const searchFields =
        row.kind === "kyc"
          ? [row.clientLabel, row.clientCode, row.stage, row.distributorName]
          : [row.clientLabel, row.clientCode, row.exceptionType, row.distributorName];
      return distributorTableSearchMatch(searchQuery, ...searchFields);
    });
  }, [combinedRows, rowFilter, searchQuery]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const clearDisabled = rowFilter === "all" && searchQuery.trim() === "";

  const aumChangeTone =
    (rollup?.aumChangeMtdPct ?? 0) >= 0 ? ("accent" as const) : ("default" as const);

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setRowFilter("all");
        setPage(1);
      }}
      clearDisabled={clearDisabled}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search KYC and exceptions…"
          aria-label="Search reports queue"
        />
      }
    >
      <StatusFilterSelect
        label="Row type"
        value={rowFilter}
        options={[
          { value: "kyc", label: "KYC pending" },
          { value: "exception", label: "Exceptions" },
        ]}
        onValueChange={(value) => {
          setRowFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label="Book reports queue"
      className="min-w-[var(--table-min-width-2xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="clientLabel" label="Client" isRowHeader allowsSorting />
        <Table.Head id="kind" label="Type" allowsSorting />
        <Table.Head id="stage" label="Detail" allowsSorting />
        <Table.Head id="daysOpen" label="Days open" allowsSorting className="text-right [&>div]:justify-end" />
        <Table.Head id="status" label="Status" allowsSorting />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(row: ReportTableRow) => (
          <Table.Row id={row.id}>
            <Table.Cell>
              <span className="font-medium">{row.clientLabel}</span>
              <p className="font-mono text-caption text-muted-foreground">{row.clientCode}</p>
            </Table.Cell>
            <Table.Cell>
              <StatusBadge variant={row.kind === "kyc" ? "warning" : "info"}>
                {row.kind === "kyc" ? "KYC pending" : "Exception"}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell className="max-w-[14rem] text-muted-foreground">
              {row.kind === "kyc" ? row.stage : row.exceptionType}
            </Table.Cell>
            <Table.Cell className="text-right tabular-nums">
              {row.kind === "kyc" ? row.daysOpen : "—"}
            </Table.Cell>
            <Table.Cell>
              {row.kind === "kyc" ? (
                <span className="text-caption text-muted-foreground">
                  Since {formatDistributorDate(row.pendingSince)}
                </span>
              ) : (
                <StatusBadge variant={exceptionStatusVariant(row.status)}>{row.status}</StatusBadge>
              )}
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <div className={cn("space-y-4", className)}>
      <BranchDistributorSquareCardGrid columns={4}>
        <BranchDistributorSquareMetricCard
          icon={LineChart}
          label="Book AUM"
          value={formatAum(rollup?.aum ?? profile.aum)}
          hint={`${rollup?.aumChangeMtdPct ?? 0}% MTD change`}
          tone="accent"
        />
        <BranchDistributorSquareMetricCard
          icon={TrendingUp}
          label="Net sales (MTD)"
          value={formatAum(rollup?.netSalesMtd ?? profile.mtdInflow)}
          hint={`SIP ${formatAum(rollup?.sipInflowMtd ?? 0)}`}
        />
        <BranchDistributorSquareMetricCard
          icon={AlertTriangle}
          label="KYC pending"
          value={String(kycRows.length)}
          hint="Open onboarding"
          tone="soft"
        />
        <BranchDistributorSquareMetricCard
          icon={TrendingDown}
          label="Redemptions (MTD)"
          value={formatAum(rollup?.redemptionsMtd ?? 0)}
          hint="Outflow from book"
          tone={aumChangeTone}
        />
      </BranchDistributorSquareCardGrid>

      <Card className="branch-perf-card overflow-hidden p-0">
        <div className="branch-perf-card__header">
          <div>
            <h3 className="branch-perf-card__title">Book AUM & net sales</h3>
            <p className="branch-perf-card__desc">Six-month trend for {profile.name}&apos;s book</p>
          </div>
        </div>
        <div
          className="branch-perf-chart h-[240px] w-full min-w-0 px-2 pb-4"
          role="img"
          aria-label="Book AUM and net sales trend"
        >
          <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
            <ComposedChart data={trend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis hide />
              <Tooltip content={renderRollupTooltip} />
              <Bar dataKey="netSales" fill="var(--chart-2)" radius={[4, 4, 0, 0]} name="Net sales" />
              <Line
                type="monotone"
                dataKey="aum"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                name="AUM"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="branch-perf-legend px-4 pb-4">
          <span className="branch-perf-legend__item">
            <span
              className="branch-perf-legend__swatch"
              style={{ background: "var(--primary)" }}
              aria-hidden
            />
            AUM
          </span>
          <span className="branch-perf-legend__item">
            <span className="branch-perf-legend__swatch branch-perf-legend__swatch--sip" aria-hidden />
            Net sales
          </span>
        </div>
      </Card>

      <section className="distributor-report-export-library !mt-0">
        <h2 className="distributor-report-export-library__title">Download reports</h2>
        <p className="text-caption text-muted-foreground">
          Export packs scoped to {profile.name}&apos;s book for branch review or HO submission.
        </p>
        <ul className="distributor-report-export-library__grid" aria-label="Downloadable reports">
          {reportTemplates.map((template) => (
            <li key={template.id}>
              <DistributorReportTemplateCard template={template} />
            </li>
          ))}
        </ul>
      </section>

      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={pageItems.length === 0}
        emptyTitle="No open report items"
        emptyDescription={ZYND_MITRA_COPY.kycClearForMitra}
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
