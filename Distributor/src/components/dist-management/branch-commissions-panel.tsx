"use client";

import { useMemo, useState } from "react";
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
import { Download, HandCoins, IndianRupee, Lock, Wallet } from "lucide-react";

import { Table, TableCard } from "@/components/application/table";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { resolveDistributorPageIcon } from "@/components/dashboard/distributor-page-icons";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import {
  BRANCH_COMMISSION_PERIOD_OPTIONS,
  DUMMY_BRANCH_COMMISSION_CATEGORIES,
  DUMMY_BRANCH_COMMISSION_CATEGORY_MIX,
  DUMMY_BRANCH_COMMISSION_HOLDS,
  DUMMY_BRANCH_COMMISSION_TREND,
  getBranchCommissionDistributorRows,
  getBranchCommissionTotals,
  type BranchCommissionHoldEntry,
  type BranchCommissionPeriod,
  type BranchDistributorCommissionRow,
} from "@/lib/dummy/branch-commissions";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { formatAum, formatDistributorDate } from "@/lib/format";

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
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 shadow-sm">
      <p className="text-caption font-medium text-foreground">{label}</p>
      <p className="mt-1 text-compact font-semibold tabular-nums text-foreground">
        {formatAum(total)} accrued
      </p>
    </div>
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
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 shadow-sm">
      <p className="text-caption font-medium text-foreground">{label}</p>
      <p className="mt-1 text-caption text-muted-foreground">Accrued {formatAum(accrued)}</p>
      <p className="text-caption text-muted-foreground">Paid {formatAum(paid)}</p>
    </div>
  );
}

function renderTrendTooltip(props: unknown) {
  return <TrendTooltip {...(props as Parameters<typeof TrendTooltip>[0])} />;
}

export function BranchCommissionsPanel({ iconName, title, description }: DistributorPageConfig) {
  const { branchLabel } = useDistributorAuth();
  const Icon = resolveDistributorPageIcon(iconName);

  const [period, setPeriod] = useState<BranchCommissionPeriod>("mtd");
  const [distributorFilter, setDistributorFilter] = useState<string | "all">("all");
  const [holdFilter, setHoldFilter] = useState<"all" | "Hold" | "Release">("all");

  const totals = useMemo(() => getBranchCommissionTotals(period), [period]);
  const distributorRows = useMemo(() => getBranchCommissionDistributorRows(period), [period]);

  const filteredDistributorRows = useMemo(() => {
    if (distributorFilter === "all") return distributorRows;
    return distributorRows.filter((row) => row.distributorId === distributorFilter);
  }, [distributorFilter, distributorRows]);

  const categoryChartData = useMemo<CategoryChartRow[]>(
    () =>
      DUMMY_BRANCH_COMMISSION_CATEGORY_MIX.map((row) => ({
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
    let rows = DUMMY_BRANCH_COMMISSION_HOLDS;
    if (distributorFilter !== "all") {
      rows = rows.filter((row) => row.distributorId === distributorFilter);
    }
    if (holdFilter !== "all") {
      rows = rows.filter((row) => row.entryType === holdFilter);
    }
    return rows;
  }, [distributorFilter, holdFilter]);

  const distributorFilterOptions = distributorRows.map((row) => ({
    value: row.distributorId,
    label: row.name,
  }));

  const filtersDefault = period === "mtd" && distributorFilter === "all" && holdFilter === "all";

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader
        icon={Icon}
        title={title}
        description={`${description} Scope: ${branchLabel}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DistributorMetricCard
          icon={HandCoins}
          label="Accrued"
          value={formatAum(totals.accrued)}
          hint={period === "mtd" ? "Month to date" : "Last calendar month"}
        />
        <DistributorMetricCard
          icon={Wallet}
          label="Released"
          value={formatAum(totals.released)}
          hint="Eligible after settlement"
        />
        <DistributorMetricCard
          icon={Lock}
          label="On hold"
          value={formatAum(totals.onHold)}
          hint="Pending txn or compliance"
        />
        <DistributorMetricCard
          icon={IndianRupee}
          label="Net payable"
          value={formatAum(totals.netPayable)}
          hint="Scheduled for payout run"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="branch-perf-card overflow-hidden p-0">
          <div className="branch-perf-card__header">
            <div>
              <h3 className="branch-perf-card__title">Commission by scheme category</h3>
              <p className="branch-perf-card__desc">MTD accrual split by distributor (demo)</p>
            </div>
          </div>
          <div
            className="branch-perf-chart h-[260px] w-full min-w-0 px-2 pb-2"
            role="img"
            aria-label="Commission by scheme category and distributor"
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
          <div className="branch-perf-card__header">
            <div>
              <h3 className="branch-perf-card__title">Branch accrual trend</h3>
              <p className="branch-perf-card__desc">Accrued vs paid (last 6 months, demo)</p>
            </div>
          </div>
          <div
            className="branch-perf-chart h-[260px] w-full min-w-0 px-2 pb-4"
            role="img"
            aria-label="Commission accrual trend"
          >
            <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
              <LineChart data={DUMMY_BRANCH_COMMISSION_TREND} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
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

      <Card className="border-border p-4">
        <h3 className="text-compact font-semibold text-foreground">MTD by category (branch)</h3>
        <p className="mt-0.5 text-caption text-muted-foreground">
          Share of total commission accrual for the selected period view.
        </p>
        <ul className="mt-4 space-y-4">
          {DUMMY_BRANCH_COMMISSION_CATEGORIES.map((row) => (
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
      </Card>

      <TableCard.Root>
        <TableCard.Header
          title="Commission by distributor"
          description="Accruals, holds, and net payable for each mapped distributor."
          contentTrailing={
            <Button type="button" variant="outline" size="sm" className="gap-1.5">
              <Download className="size-3.5" aria-hidden />
              Export CSV
            </Button>
          }
        />
        <div className="border-b border-border px-4 py-3">
          <DistributorTableToolbar
            onClearAll={() => {
              setPeriod("mtd");
              setDistributorFilter("all");
            }}
            clearDisabled={filtersDefault}
          >
            <StatusFilterSelect
              label="Period"
              value={period}
              options={BRANCH_COMMISSION_PERIOD_OPTIONS}
              onValueChange={(value) => {
                if (value !== "all") setPeriod(value);
              }}
            />
            <StatusFilterSelect
              label="Distributor"
              value={distributorFilter}
              options={distributorFilterOptions}
              onValueChange={setDistributorFilter}
            />
          </DistributorTableToolbar>
        </div>
        <TableCard.Content>
          <Table aria-label="Commission by distributor" size="md" className="min-w-[var(--table-min-width-3xl)]">
            <Table.Header>
              <Table.Head isRowHeader>Distributor</Table.Head>
              <Table.Head>ARN</Table.Head>
              <Table.Head className="text-right [&>div]:justify-end">Accrued</Table.Head>
              <Table.Head className="text-right [&>div]:justify-end">Released</Table.Head>
              <Table.Head className="text-right [&>div]:justify-end">On hold</Table.Head>
              <Table.Head className="text-right [&>div]:justify-end">Net payable</Table.Head>
              <Table.Head>Payout</Table.Head>
            </Table.Header>
            <Table.Body items={filteredDistributorRows}>
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
          </Table>
        </TableCard.Content>
      </TableCard.Root>

      <TableCard.Root>
        <TableCard.Header
          title="Holds & releases"
          description="Settlement-linked hold and release events (demo ledger)."
        />
        <div className="border-b border-border px-4 py-3">
          <DistributorTableToolbar
            onClearAll={() => setHoldFilter("all")}
            clearDisabled={holdFilter === "all"}
          >
            <StatusFilterSelect
              label="Entry type"
              value={holdFilter}
              options={[
                { value: "Hold", label: "Hold" },
                { value: "Release", label: "Release" },
              ]}
              onValueChange={setHoldFilter}
            />
          </DistributorTableToolbar>
        </div>
        <TableCard.Content>
          <Table aria-label="Commission holds and releases" size="md" className="min-w-[var(--table-min-width-3xl)]">
            <Table.Header>
              <Table.Head isRowHeader>Distributor</Table.Head>
              <Table.Head>Type</Table.Head>
              <Table.Head className="text-right [&>div]:justify-end">Amount</Table.Head>
              <Table.Head>Reason</Table.Head>
              <Table.Head>Txn ref</Table.Head>
              <Table.Head>Settlement</Table.Head>
              <Table.Head>Effective</Table.Head>
            </Table.Header>
            <Table.Body items={filteredHolds}>
              {(entry) => (
                <Table.Row id={entry.id}>
                  <Table.Cell className="font-medium">{entry.distributorName}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge variant={holdEntryVariant(entry.entryType)}>{entry.entryType}</StatusBadge>
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
          </Table>
        </TableCard.Content>
      </TableCard.Root>
    </div>
  );
}
