"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Download,
  FileSpreadsheet,
} from "lucide-react";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { BranchPerfCardHeader } from "@/components/dist-management/branch-perf-card-header";
import { BranchReportsMetrics } from "@/components/dist-management/branch-reports-metrics";
import { BranchScheduledReportCard } from "@/components/dist-management/branch-scheduled-report-card";
import {
  BRANCH_REPORTS_TABLE_SUB_TAB_LABELS,
  type BranchReportsTableSubTabId,
} from "@/components/dist-management/branch-reports-table-sub-tab-ids";
import { BranchReportsTableSubTabs } from "@/components/dist-management/branch-reports-table-sub-tabs";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { Card } from "@/components/ui/card";
import { DistributorChartTooltip } from "@/components/ui/distributor-chart-tooltip";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import {
  BRANCH_KYC_STAGE_OPTIONS,
  BRANCH_REPORT_ROLLUP_PERIOD_OPTIONS,
  DUMMY_BRANCH_AUM_SALES_ROLLUP,
  DUMMY_BRANCH_COMPLIANCE_EXCEPTIONS,
  DUMMY_BRANCH_KYC_PENDING,
  DUMMY_BRANCH_REPORT_TREND,
  DUMMY_BRANCH_SCHEDULED_REPORTS,
  getBranchAumSalesRollup,
  type BranchComplianceException,
  type BranchReportRollupPeriod,
} from "@/lib/dummy/branch-reports";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { formatAum, formatDistributorDate } from "@/lib/format";

const CHART_HEIGHT = 260;

function severityVariant(severity: BranchComplianceException["severity"]): StatusBadgeVariant {
  if (severity === "High") return "destructive";
  if (severity === "Medium") return "warning";
  return "neutral";
}

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

function SalesMixTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <DistributorChartTooltip>
      <p className="text-caption font-medium text-foreground">{label}</p>
      <p className="text-compact font-semibold tabular-nums text-foreground">{formatAum(value)}</p>
    </DistributorChartTooltip>
  );
}

function renderSalesMixTooltip(props: unknown) {
  return <SalesMixTooltip {...(props as Parameters<typeof SalesMixTooltip>[0])} />;
}

export function BranchReportsPanel({
  title,
  description,
  embedded = false,
}: DistributorPageConfig & { embedded?: boolean }) {
  const { branchLabel } = useDistributorAuth();

  const [rollupSearch, setRollupSearch] = useState("");
  const [rollupPeriod, setRollupPeriod] = useState<BranchReportRollupPeriod>("mtd");
  const [rollupDistributorFilter, setRollupDistributorFilter] = useState<string | "all">("all");
  const [kycSearch, setKycSearch] = useState("");
  const [exceptionSearch, setExceptionSearch] = useState("");
  const [kycDistributorFilter, setKycDistributorFilter] = useState<string | "all">("all");
  const [kycStageFilter, setKycStageFilter] = useState<string | "all">("all");
  const [exceptionDistributorFilter, setExceptionDistributorFilter] = useState<string | "all">("all");
  const [exceptionFilter, setExceptionFilter] = useState<"all" | BranchComplianceException["status"]>(
    "all",
  );
  const [activeTableTab, setActiveTableTab] = useState<BranchReportsTableSubTabId>("rollup");
  const [isTableTabPending, startTableTabTransition] = useTransition();
  const [scheduledReports, setScheduledReports] = useState(DUMMY_BRANCH_SCHEDULED_REPORTS);

  const onTableTabChange = useCallback((tab: BranchReportsTableSubTabId) => {
    startTableTabTransition(() => {
      setActiveTableTab(tab);
    });
  }, []);

  const distributorOptions = DUMMY_BRANCH_AUM_SALES_ROLLUP.map((row) => ({
    value: row.distributorId,
    label: row.name,
  }));

  const rollupRows = useMemo(() => getBranchAumSalesRollup(rollupPeriod), [rollupPeriod]);

  const filteredKyc = useMemo(() => {
    let rows = DUMMY_BRANCH_KYC_PENDING;
    if (kycDistributorFilter !== "all") {
      const name = distributorOptions.find((o) => o.value === kycDistributorFilter)?.label;
      rows = rows.filter((row) => row.distributorName === name);
    }
    if (kycStageFilter !== "all") {
      rows = rows.filter((row) => row.stage === kycStageFilter);
    }
    return rows.filter((row) =>
      distributorTableSearchMatch(
        kycSearch,
        row.clientLabel,
        row.clientCode,
        row.distributorName,
        row.stage,
      ),
    );
  }, [kycDistributorFilter, kycStageFilter, distributorOptions, kycSearch]);

  const filteredExceptions = useMemo(() => {
    let rows = DUMMY_BRANCH_COMPLIANCE_EXCEPTIONS;
    if (exceptionDistributorFilter !== "all") {
      const name = distributorOptions.find((o) => o.value === exceptionDistributorFilter)?.label;
      rows = rows.filter((row) => row.distributorName === name);
    }
    if (exceptionFilter !== "all") {
      rows = rows.filter((row) => row.status === exceptionFilter);
    }
    return rows.filter((row) =>
      distributorTableSearchMatch(
        exceptionSearch,
        row.clientLabel,
        row.clientCode,
        row.distributorName,
        row.exceptionType,
        row.severity,
        row.status,
      ),
    );
  }, [exceptionDistributorFilter, distributorOptions, exceptionFilter, exceptionSearch]);

  const filteredRollup = useMemo(() => {
    return rollupRows.filter((row) => {
      if (rollupDistributorFilter !== "all" && row.distributorId !== rollupDistributorFilter) {
        return false;
      }
      return distributorTableSearchMatch(rollupSearch, row.name, row.distributorId);
    });
  }, [rollupDistributorFilter, rollupRows, rollupSearch]);

  const {
    pageItems: rollupPageItems,
    pagination: rollupPagination,
    setPage: setRollupPage,
  } = useDistributorTablePagination(filteredRollup);
  const {
    pageItems: kycPageItems,
    pagination: kycPagination,
    setPage: setKycPage,
  } = useDistributorTablePagination(filteredKyc);
  const {
    pageItems: exceptionPageItems,
    pagination: exceptionPagination,
    setPage: setExceptionPage,
  } = useDistributorTablePagination(filteredExceptions);

  const salesByDistributor = useMemo(
    () =>
      DUMMY_BRANCH_AUM_SALES_ROLLUP.map((row) => ({
        name: row.name.split(" ")[0] ?? row.name,
        netSales: row.netSalesMtd,
      })),
    [],
  );

  const toggleReport = (id: string, enabled: boolean) => {
    setScheduledReports((prev) =>
      prev.map((report) => (report.id === id ? { ...report, enabled } : report)),
    );
  };

  const rollupFiltersDefault =
    rollupPeriod === "mtd" && rollupDistributorFilter === "all" && rollupSearch.trim() === "";
  const kycFiltersDefault =
    kycDistributorFilter === "all" && kycStageFilter === "all" && kycSearch.trim() === "";
  const exceptionFiltersDefault =
    exceptionDistributorFilter === "all" &&
    exceptionFilter === "all" &&
    exceptionSearch.trim() === "";

  const rollupToolbar = (
    <DistributorTableToolbar
      leading={
        <>
          <DistributorActionButton type="button" variant="outline" size="sm" className="gap-1.5">
            <FileSpreadsheet className="size-3.5" aria-hidden />
            Excel
          </DistributorActionButton>
          <DistributorActionButton type="button" variant="outline" size="sm" className="gap-1.5">
            <Download className="size-3.5" aria-hidden />
            CSV
          </DistributorActionButton>
        </>
      }
      onClearAll={() => {
        setRollupPeriod("mtd");
        setRollupDistributorFilter("all");
        setRollupSearch("");
        setRollupPage(1);
      }}
      clearDisabled={rollupFiltersDefault}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={rollupSearch}
          onChange={(value) => {
            setRollupSearch(value);
            setRollupPage(1);
          }}
          placeholder="Search roll-up…"
          aria-label="Search AUM and sales roll-up"
        />
      }
    >
      <StatusFilterSelect
        label="Period"
        value={rollupPeriod}
        options={BRANCH_REPORT_ROLLUP_PERIOD_OPTIONS}
        onValueChange={(value) => {
          if (value !== "all") setRollupPeriod(value);
          setRollupPage(1);
        }}
      />
      <StatusFilterSelect
        label={ZYND_MITRA_COPY.tableColumnMitra}
        value={rollupDistributorFilter}
        options={distributorOptions}
        onValueChange={(value) => {
          setRollupDistributorFilter(value);
          setRollupPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const kycToolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setKycDistributorFilter("all");
        setKycStageFilter("all");
        setKycSearch("");
        setKycPage(1);
      }}
      clearDisabled={kycFiltersDefault}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={kycSearch}
          onChange={(value) => {
            setKycSearch(value);
            setKycPage(1);
          }}
          placeholder="Search KYC pending…"
          aria-label="Search KYC pending"
        />
      }
    >
      <StatusFilterSelect
        label={ZYND_MITRA_COPY.tableColumnMitra}
        value={kycDistributorFilter}
        options={distributorOptions}
        onValueChange={(value) => {
          setKycDistributorFilter(value);
          setKycPage(1);
        }}
      />
      <StatusFilterSelect
        label="Stage"
        value={kycStageFilter}
        options={BRANCH_KYC_STAGE_OPTIONS}
        onValueChange={(value) => {
          setKycStageFilter(value);
          setKycPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const exceptionToolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setExceptionDistributorFilter("all");
        setExceptionFilter("all");
        setExceptionSearch("");
        setExceptionPage(1);
      }}
      clearDisabled={exceptionFiltersDefault}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={exceptionSearch}
          onChange={(value) => {
            setExceptionSearch(value);
            setExceptionPage(1);
          }}
          placeholder="Search exceptions…"
          aria-label="Search compliance exceptions"
        />
      }
    >
      <StatusFilterSelect
        label={ZYND_MITRA_COPY.tableColumnMitra}
        value={exceptionDistributorFilter}
        options={distributorOptions}
        onValueChange={(value) => {
          setExceptionDistributorFilter(value);
          setExceptionPage(1);
        }}
      />
      <StatusFilterSelect
        label="Status"
        value={exceptionFilter}
        options={[
          { value: "Open", label: "Open" },
          { value: "In review", label: "In review" },
          { value: "Resolved", label: "Resolved" },
        ]}
        onValueChange={(value) => {
          setExceptionFilter(value);
          setExceptionPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  return (
    <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "min-w-0")}>
      {!embedded ? (
        <DistributorPageHeader
          title={title}
          description={`${description} Scope: ${branchLabel}.`}
        />
      ) : null}

      <BranchReportsMetrics />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="branch-perf-card overflow-hidden p-0">
          <BranchPerfCardHeader eyebrow="Six-month trend" title="Branch AUM & net sales" />
          <div
            className="branch-perf-chart h-[260px] w-full min-w-0 px-2 pb-4"
            role="img"
            aria-label="Branch AUM and net sales trend"
          >
            <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
              <ComposedChart data={DUMMY_BRANCH_REPORT_TREND} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
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

        <Card className="branch-perf-card overflow-hidden p-0">
          <BranchPerfCardHeader eyebrow="Sales roll-up" title={ZYND_MITRA_COPY.netSalesByMitra} />
          <div
            className="branch-perf-chart h-[260px] w-full min-w-0 px-2 pb-4"
            role="img"
            aria-label={ZYND_MITRA_COPY.netSalesAria}
          >
            <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
              <BarChart data={salesByDistributor} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis hide />
                <Tooltip content={renderSalesMixTooltip} cursor={{ fill: "var(--muted)", opacity: 0.35 }} />
                <Bar dataKey="netSales" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="distributor-branch-distributor-work-subtabs">
        <DistributorPageHeader
          title={BRANCH_REPORTS_TABLE_SUB_TAB_LABELS[activeTableTab]}
          titleAs="h3"
          titleSwitchKey={activeTableTab}
          titleClassName="text-caption font-medium uppercase tracking-wide text-muted-foreground"
          className="distributor-client-activity-tab__subheader"
        >
          <BranchReportsTableSubTabs
            value={activeTableTab}
            onChange={onTableTabChange}
            busy={isTableTabPending}
          />
        </DistributorPageHeader>

        <div
          key={activeTableTab}
          role="tabpanel"
          id={`branch-reports-table-sub-panel-${activeTableTab}`}
          aria-labelledby={`branch-reports-table-sub-tab-${activeTableTab}`}
          className={cn(
            "distributor-client-activity-tab__panel distributor-client-activity-tab__panel--enter",
            isTableTabPending && "distributor-client-activity-tab__panel--pending",
          )}
        >
          {activeTableTab === "rollup" ? (
            <DistributorTableOnlyShell
              toolbar={rollupToolbar}
              isEmpty={filteredRollup.length === 0}
              emptyTitle="No roll-up rows match your search"
              emptyDescription={ZYND_MITRA_COPY.adjustPeriodMitra}
              tableSize="md"
            >
              {wrapDistributorTableBody(
                <Table
                  aria-label="AUM and sales roll-up"
                  size="md"
                  className="min-w-[var(--table-min-width-3xl)]"
                  pagination={rollupPagination}
                >
                  <Table.Header>
                    <Table.Head isRowHeader>{ZYND_MITRA_COPY.tableColumnMitra}</Table.Head>
                    <Table.Head className="text-right [&>div]:justify-end">AUM</Table.Head>
                    <Table.Head className="text-right [&>div]:justify-end">AUM Δ MTD</Table.Head>
                    <Table.Head className="text-right [&>div]:justify-end">Net sales</Table.Head>
                    <Table.Head className="text-right [&>div]:justify-end">SIP inflow</Table.Head>
                    <Table.Head className="text-right [&>div]:justify-end">Redemptions</Table.Head>
                  </Table.Header>
                  <Table.Body items={rollupPageItems}>
                    {(row) => (
                      <Table.Row id={row.distributorId}>
                        <Table.Cell className="font-medium">{row.name}</Table.Cell>
                        <Table.Cell className="text-right tabular-nums">{formatAum(row.aum)}</Table.Cell>
                        <Table.Cell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          +{row.aumChangeMtdPct.toFixed(1)}%
                        </Table.Cell>
                        <Table.Cell className="text-right tabular-nums">{formatAum(row.netSalesMtd)}</Table.Cell>
                        <Table.Cell className="text-right tabular-nums">{formatAum(row.sipInflowMtd)}</Table.Cell>
                        <Table.Cell className="text-right tabular-nums">{formatAum(row.redemptionsMtd)}</Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table>,
              )}
            </DistributorTableOnlyShell>
          ) : null}

          {activeTableTab === "kyc-pending" ? (
            <DistributorTableOnlyShell
              toolbar={kycToolbar}
              isEmpty={filteredKyc.length === 0}
              emptyTitle="No KYC pending cases match"
              emptyDescription={ZYND_MITRA_COPY.adjustStageMitra}
              tableSize="md"
            >
              {wrapDistributorTableBody(
                <Table
                  aria-label="KYC pending"
                  size="md"
                  className="min-w-[var(--table-min-width-xl)]"
                  pagination={kycPagination}
                >
                  <Table.Header>
                    <Table.Head isRowHeader>Client</Table.Head>
                    <Table.Head>{ZYND_MITRA_COPY.tableColumnMitra}</Table.Head>
                    <Table.Head>Stage</Table.Head>
                    <Table.Head className="text-right [&>div]:justify-end">Days open</Table.Head>
                    <Table.Head>Since</Table.Head>
                  </Table.Header>
                  <Table.Body items={kycPageItems}>
                    {(row) => (
                      <Table.Row id={row.id}>
                        <Table.Cell>
                          <span className="font-medium">{row.clientLabel}</span>
                          <span className="mt-0.5 block font-mono text-caption text-muted-foreground">
                            {row.clientCode}
                          </span>
                        </Table.Cell>
                        <Table.Cell>{row.distributorName}</Table.Cell>
                        <Table.Cell className="text-muted-foreground">{row.stage}</Table.Cell>
                        <Table.Cell className="text-right tabular-nums">{row.daysOpen}</Table.Cell>
                        <Table.Cell className="text-muted-foreground">
                          {formatDistributorDate(row.pendingSince)}
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table>,
              )}
            </DistributorTableOnlyShell>
          ) : null}

          {activeTableTab === "compliance" ? (
            <DistributorTableOnlyShell
              toolbar={exceptionToolbar}
              isEmpty={filteredExceptions.length === 0}
              emptyTitle="No compliance exceptions match"
              emptyDescription="Adjust filters or search to reset."
              tableSize="md"
            >
              {wrapDistributorTableBody(
                <Table
                  aria-label="Compliance exceptions"
                  size="md"
                  className="min-w-[var(--table-min-width-xl)]"
                  pagination={exceptionPagination}
                >
                  <Table.Header>
                    <Table.Head isRowHeader>Client</Table.Head>
                    <Table.Head>Exception</Table.Head>
                    <Table.Head>Severity</Table.Head>
                    <Table.Head>Status</Table.Head>
                  </Table.Header>
                  <Table.Body items={exceptionPageItems}>
                    {(row) => (
                      <Table.Row id={row.id}>
                        <Table.Cell>
                          <span className="font-medium">{row.clientLabel}</span>
                          <span className="mt-0.5 block font-mono text-caption text-muted-foreground">
                            {row.clientCode}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="max-w-[14rem] text-caption text-muted-foreground">
                          {row.exceptionType}
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge variant={severityVariant(row.severity)}>{row.severity}</StatusBadge>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge variant={exceptionStatusVariant(row.status)}>{row.status}</StatusBadge>
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

      <section className="distributor-branch-scheduled-reports">
        <h2 className="distributor-branch-scheduled-reports__label">Scheduled email reports to HO</h2>
        <ul className="distributor-branch-scheduled-reports__grid">
          {scheduledReports.map((report) => (
            <li key={report.id}>
              <BranchScheduledReportCard report={report} onToggle={toggleReport} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
