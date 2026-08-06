"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { BranchIncentivesMetrics } from "@/components/dist-management/branch-incentives-metrics";
import {
  BRANCH_INCENTIVES_TABLE_SUB_TAB_LABELS,
  type BranchIncentivesTableSubTabId,
} from "@/components/dist-management/branch-incentives-table-sub-tab-ids";
import { BranchIncentivesTableSubTabs } from "@/components/dist-management/branch-incentives-table-sub-tabs";
import { BranchPerfCardHeader } from "@/components/dist-management/branch-perf-card-header";
import { BranchPerfChartTooltip } from "@/components/dist-management/branch-perf-chart-tooltip";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import {
  BRANCH_COMMISSION_PERIOD_OPTIONS,
  BRANCH_COMMISSION_CATEGORIES,
  BRANCH_COMMISSION_CATEGORY_MIX,
  BRANCH_COMMISSION_HOLDS,
  BRANCH_COMMISSION_TREND,
  getBranchCommissionDistributorRows,
  type BranchCommissionHoldEntry,
  type BranchCommissionPeriod,
  type BranchDistributorCommissionRow,
} from "@/lib/distributor-branch-commissions-data";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

const CHART_HEIGHT = 260;

type CategoryChartRow = {
  name: string;
  equity: number;
  debt: number;
  liquid: number;
  elss: number;
  other: number;
};

function payoutStatusVariant(status: BranchDistributorCommissionRow["payoutStatus"]): StatusBadgeVariant {
  if (status === "Paid") return "success";
  if (status === "Scheduled") return "neutral";
  if (status === "Partial hold") return "warning";
  return "destructive";
}

function holdEntryVariant(entry: BranchCommissionHoldEntry["entryType"]): StatusBadgeVariant {
  return entry === "Release" ? "success" : "warning";
}

function settlementVariant(status: BranchCommissionHoldEntry["settlementStatus"]): StatusBadgeVariant {
  if (status === "Settled") return "success";
  if (status === "Reversed") return "destructive";
  return "warning";
}

function CategoryMixTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const total = payload.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
  return (
    <BranchPerfChartTooltip
      label={label}
      rows={[{ label: "Accrued", value: formatAum(total) }]}
    />
  );
}

function renderCategoryMixTooltip(props: unknown) {
  return <CategoryMixTooltip {...(props as Parameters<typeof CategoryMixTooltip>[0])} />;
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const accrued = Number(payload.find((p) => p.dataKey === "accrued")?.value ?? 0);
  const paid = Number(payload.find((p) => p.dataKey === "paid")?.value ?? 0);
  return (
    <BranchPerfChartTooltip
      label={label}
      rows={[
        { label: "Accrued", value: formatAum(accrued) },
        { label: "Paid", value: formatAum(paid) },
      ]}
    />
  );
}

function renderTrendTooltip(props: unknown) {
  return <TrendTooltip {...(props as Parameters<typeof TrendTooltip>[0])} />;
}

export function BranchCommissionsPanel({
  title,
  description,
  embedded = false,
}: DistributorPageConfig & { embedded?: boolean }) {
  const [period, setPeriod] = useState<BranchCommissionPeriod>("mtd");
  const [distributorFilter, setDistributorFilter] = useState<string | "all">("all");
  const [holdFilter, setHoldFilter] = useState<"all" | "Hold" | "Release">("all");
  const [holdDistributorFilter, setHoldDistributorFilter] = useState<string | "all">("all");
  const [distributorSearch, setDistributorSearch] = useState("");
  const [holdSearch, setHoldSearch] = useState("");
  const [activeTableTab, setActiveTableTab] = useState<BranchIncentivesTableSubTabId>("by-distributor");
  const [isTableTabPending, startTableTabTransition] = useTransition();

  const onTableTabChange = useCallback((tab: BranchIncentivesTableSubTabId) => {
    startTableTabTransition(() => {
      setActiveTableTab(tab);
    });
  }, []);

  const distributorRows = useMemo(() => getBranchCommissionDistributorRows(period), [period]);

  const filteredDistributorRows = useMemo(() => {
    return distributorRows.filter((row) => {
      if (distributorFilter !== "all" && row.distributorId !== distributorFilter) return false;
      return distributorTableSearchMatch(distributorSearch, row.name, row.arn, row.payoutStatus);
    });
  }, [distributorFilter, distributorRows, distributorSearch]);

  const categoryChartData = useMemo<CategoryChartRow[]>(
    () =>
      BRANCH_COMMISSION_CATEGORY_MIX.map((row) => ({
        name: row.name,
        equity: row.equity,
        debt: row.debt,
        liquid: row.liquid,
        elss: row.elss,
        other: row.other,
      })),
    [],
  );

  const filteredHolds = useMemo(() => {
    let rows = BRANCH_COMMISSION_HOLDS;
    if (holdDistributorFilter !== "all") {
      rows = rows.filter((row) => row.distributorId === holdDistributorFilter);
    }
    if (holdFilter !== "all") {
      rows = rows.filter((row) => row.entryType === holdFilter);
    }
    return rows.filter((row) =>
      distributorTableSearchMatch(
        holdSearch,
        row.distributorName,
        row.reason,
        row.txnRef,
        row.entryType,
        row.settlementStatus,
      ),
    );
  }, [holdDistributorFilter, holdFilter, holdSearch]);

  const {
    pageItems: distributorPageItems,
    pagination: distributorPagination,
    setPage: setDistributorPage,
  } = useDistributorTablePagination(filteredDistributorRows);
  const {
    pageItems: holdPageItems,
    pagination: holdPagination,
    setPage: setHoldPage,
  } = useDistributorTablePagination(filteredHolds);

  const distributorFilterOptions = distributorRows.map((row) => ({
    value: row.distributorId,
    label: row.name,
  }));

  const filtersDefault = period === "mtd" && distributorFilter === "all" && distributorSearch.trim() === "";
  const holdFiltersDefault =
    holdFilter === "all" && holdDistributorFilter === "all" && holdSearch.trim() === "";

  const distributorToolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setPeriod("mtd");
        setDistributorFilter("all");
        setDistributorSearch("");
        setDistributorPage(1);
      }}
      clearDisabled={filtersDefault}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={distributorSearch}
          onChange={(value) => {
            setDistributorSearch(value);
            setDistributorPage(1);
          }}
          placeholder={ZYND_MITRA_COPY.searchPlaceholder}
          aria-label={ZYND_MITRA_COPY.searchIncentiveAria}
        />
      }
    >
      <StatusFilterSelect
        label="Period"
        value={period}
        options={BRANCH_COMMISSION_PERIOD_OPTIONS}
        onValueChange={(value) => {
          if (value !== "all") setPeriod(value);
          setDistributorPage(1);
        }}
      />
      <StatusFilterSelect
        label={ZYND_MITRA_COPY.tableColumnMitra}
        value={distributorFilter}
        options={distributorFilterOptions}
        onValueChange={(value) => {
          setDistributorFilter(value);
          setDistributorPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const holdToolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setHoldFilter("all");
        setHoldDistributorFilter("all");
        setHoldSearch("");
        setHoldPage(1);
      }}
      clearDisabled={holdFiltersDefault}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={holdSearch}
          onChange={(value) => {
            setHoldSearch(value);
            setHoldPage(1);
          }}
          placeholder="Search holds & releases…"
          aria-label="Search incentive holds and releases"
        />
      }
    >
      <StatusFilterSelect
        label="Entry type"
        value={holdFilter}
        options={[
          { value: "Hold", label: "Hold" },
          { value: "Release", label: "Release" },
        ]}
        onValueChange={(value) => {
          setHoldFilter(value);
          setHoldPage(1);
        }}
      />
      <StatusFilterSelect
        label={ZYND_MITRA_COPY.tableColumnMitra}
        value={holdDistributorFilter}
        options={distributorFilterOptions}
        onValueChange={(value) => {
          setHoldDistributorFilter(value);
          setHoldPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  return (
    <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "min-w-0")}>
      {!embedded ? <DistributorPageHeader title={title} description={description} /> : null}

      <BranchIncentivesMetrics period={period} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="branch-perf-card overflow-hidden p-0">
          <BranchPerfCardHeader eyebrow="MTD accrual" title="Incentive by scheme category" />
          <div
            className="branch-perf-chart h-[260px] w-full min-w-0 px-2 pb-2"
            role="img"
            aria-label={ZYND_MITRA_COPY.schemeIncentiveAria}
          >
            <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
              <BarChart data={categoryChartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis hide />
                <Tooltip content={renderCategoryMixTooltip} cursor={{ fill: "var(--muted)", opacity: 0.35 }} />
                <Bar dataKey="equity" stackId="cat" fill="var(--chart-1)" name="Equity" />
                <Bar dataKey="elss" stackId="cat" fill="var(--chart-2)" name="ELSS" />
                <Bar dataKey="debt" stackId="cat" fill="var(--chart-3)" name="Debt" />
                <Bar dataKey="liquid" stackId="cat" fill="var(--chart-4)" name="Liquid" />
                <Bar dataKey="other" stackId="cat" fill="var(--chart-5)" radius={[4, 4, 0, 0]} name="Other" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 px-4 pb-4 text-caption text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[var(--chart-1)]" aria-hidden />
              Equity
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[var(--chart-2)]" aria-hidden />
              ELSS
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[var(--chart-3)]" aria-hidden />
              Debt
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[var(--chart-4)]" aria-hidden />
              Liquid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[var(--chart-5)]" aria-hidden />
              Other
            </span>
          </div>
        </Card>

        <Card className="branch-perf-card overflow-hidden p-0">
          <BranchPerfCardHeader eyebrow="Last 6 months" title="Branch incentive trend" />
          <div
            className="branch-perf-chart h-[260px] w-full min-w-0 px-2 pb-4"
            role="img"
            aria-label="Incentive accrual trend"
          >
            <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
              <LineChart data={BRANCH_COMMISSION_TREND} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis hide />
                <Tooltip content={renderTrendTooltip} />
                <Line
                  type="monotone"
                  dataKey="accrued"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                  name="Accrued"
                />
                <Line
                  type="monotone"
                  dataKey="paid"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Paid"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="branch-perf-legend px-4 pb-4">
            <span className="branch-perf-legend__item">
              <span
                className="branch-perf-legend__swatch"
                style={{ background: "var(--primary)" }}
                aria-hidden
              />
              Accrued
            </span>
            <span className="branch-perf-legend__item">
              <span
                className="branch-perf-legend__swatch branch-perf-legend__swatch--sip"
                aria-hidden
              />
              Paid
            </span>
          </div>
        </Card>
      </div>

      <Card className="branch-perf-card overflow-hidden p-0">
        <BranchPerfCardHeader eyebrow="Category share" title="MTD by category (branch)" />
        <div className="branch-perf-card__body">
          <ul className="space-y-4">
          {BRANCH_COMMISSION_CATEGORIES.map((row) => (
            <li key={row.id}>
              <div className="flex items-center justify-between gap-3 text-caption">
                <span className="font-medium text-foreground">{row.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatAum(row.amount)} · {row.sharePct}%
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${row.sharePct}%` }}
                />
              </div>
            </li>
          ))}
          </ul>
        </div>
      </Card>

      <div className="distributor-branch-distributor-work-subtabs">
        <DistributorPageHeader
          title={BRANCH_INCENTIVES_TABLE_SUB_TAB_LABELS[activeTableTab]}
          titleAs="h3"
          titleSwitchKey={activeTableTab}
          titleClassName="text-caption font-medium uppercase tracking-wide text-muted-foreground"
          className="distributor-client-activity-tab__subheader"
        >
          <BranchIncentivesTableSubTabs
            value={activeTableTab}
            onChange={onTableTabChange}
            busy={isTableTabPending}
          />
        </DistributorPageHeader>

        <div
          key={activeTableTab}
          role="tabpanel"
          id={`branch-incentives-table-sub-panel-${activeTableTab}`}
          aria-labelledby={`branch-incentives-table-sub-tab-${activeTableTab}`}
          className={cn(
            "distributor-client-activity-tab__panel distributor-client-activity-tab__panel--enter",
            isTableTabPending && "distributor-client-activity-tab__panel--pending",
          )}
        >
          {activeTableTab === "by-distributor" ? (
            <DistributorTableOnlyShell
              toolbar={distributorToolbar}
              isEmpty={filteredDistributorRows.length === 0}
              emptyTitle={
                distributorRows.length === 0 && filtersDefault
                  ? "No incentive data yet"
                  : ZYND_MITRA_COPY.emptyFiltered
              }
              emptyDescription={
                distributorRows.length === 0 && filtersDefault
                  ? "Accrued and released incentives will appear here once available."
                  : ZYND_MITRA_COPY.adjustPeriodMitra
              }
              tableSize="md"
            >
              {wrapDistributorTableBody(
                <Table
                  aria-label={ZYND_MITRA_COPY.incentiveByMitra}
                  size="md"
                  className="min-w-[var(--table-min-width-3xl)]"
                  pagination={distributorPagination}
                >
                  <Table.Header>
                    <Table.Head isRowHeader>{ZYND_MITRA_COPY.tableColumnMitra}</Table.Head>
                    <Table.Head>ARN</Table.Head>
                    <Table.Head className="text-right [&>div]:justify-end">Accrued</Table.Head>
                    <Table.Head className="text-right [&>div]:justify-end">Released</Table.Head>
                    <Table.Head className="text-right [&>div]:justify-end">On hold</Table.Head>
                    <Table.Head className="text-right [&>div]:justify-end">Net payable</Table.Head>
                    <Table.Head>Payout</Table.Head>
                  </Table.Header>
                  <Table.Body items={distributorPageItems}>
                    {(row) => (
                      <Table.Row id={row.distributorId}>
                        <Table.Cell className="font-medium">{row.name}</Table.Cell>
                        <Table.Cell className="font-mono text-caption">{row.arn}</Table.Cell>
                        <Table.Cell className="text-right tabular-nums">{formatAum(row.accrued)}</Table.Cell>
                        <Table.Cell className="text-right tabular-nums">{formatAum(row.released)}</Table.Cell>
                        <Table.Cell className="text-right tabular-nums">
                          {row.onHold > 0 ? formatAum(row.onHold) : "—"}
                        </Table.Cell>
                        <Table.Cell className="text-right tabular-nums">{formatAum(row.netPayable)}</Table.Cell>
                        <Table.Cell>
                          <StatusBadge variant={payoutStatusVariant(row.payoutStatus)}>
                            {row.payoutStatus}
                          </StatusBadge>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table>,
              )}
            </DistributorTableOnlyShell>
          ) : null}

          {activeTableTab === "holds-releases" ? (
            <DistributorTableOnlyShell
              toolbar={holdToolbar}
              isEmpty={filteredHolds.length === 0}
              emptyTitle="No hold or release entries match"
              emptyDescription={ZYND_MITRA_COPY.adjustEntryMitra}
              tableSize="md"
            >
              {wrapDistributorTableBody(
                <Table
                  aria-label="Incentive holds and releases"
                  size="md"
                  className="min-w-[var(--table-min-width-3xl)]"
                  pagination={holdPagination}
                >
                  <Table.Header>
                    <Table.Head isRowHeader>{ZYND_MITRA_COPY.tableColumnMitra}</Table.Head>
                    <Table.Head>Type</Table.Head>
                    <Table.Head className="text-right [&>div]:justify-end">Amount</Table.Head>
                    <Table.Head>Reason</Table.Head>
                    <Table.Head>Txn ref</Table.Head>
                    <Table.Head>Settlement</Table.Head>
                    <Table.Head>Effective</Table.Head>
                  </Table.Header>
                  <Table.Body items={holdPageItems}>
                    {(entry) => (
                      <Table.Row id={entry.id}>
                        <Table.Cell className="font-medium">{entry.distributorName}</Table.Cell>
                        <Table.Cell>
                          <StatusBadge variant={holdEntryVariant(entry.entryType)}>
                            {entry.entryType}
                          </StatusBadge>
                        </Table.Cell>
                        <Table.Cell className="text-right tabular-nums">{formatAum(entry.amount)}</Table.Cell>
                        <Table.Cell className="max-w-[16rem] text-muted-foreground">{entry.reason}</Table.Cell>
                        <Table.Cell className="font-mono text-caption">{entry.txnRef}</Table.Cell>
                        <Table.Cell>
                          <StatusBadge variant={settlementVariant(entry.settlementStatus)}>
                            {entry.settlementStatus}
                          </StatusBadge>
                        </Table.Cell>
                        <Table.Cell className="text-muted-foreground">
                          {formatDistributorDate(entry.effectiveAt)}
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table>,
              )}
            </DistributorTableOnlyShell>
          ) : null}
        </div>
      </div>
    </div>
  );
}
