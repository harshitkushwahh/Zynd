"use client";

import { useMemo, useState } from "react";
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
  AlertTriangle,
  ClipboardList,
  Download,
  FileSpreadsheet,
  LineChart,
  Mail,
  TrendingUp,
  Users,
} from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import {
  DUMMY_BRANCH_AUM_SALES_ROLLUP,
  DUMMY_BRANCH_COMPLIANCE_EXCEPTIONS,
  DUMMY_BRANCH_KYC_PENDING,
  DUMMY_BRANCH_REPORT_TREND,
  DUMMY_BRANCH_SCHEDULED_REPORTS,
  getBranchReportSummary,
  type BranchComplianceException,
  type BranchScheduledReport,
} from "@/lib/dummy/branch-reports";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
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
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 shadow-sm">
      <p className="text-caption font-medium text-foreground">{label}</p>
      <p className="mt-1 text-caption text-muted-foreground">AUM {formatAum(aum)}</p>
      <p className="text-caption text-muted-foreground">Net sales {formatAum(netSales)}</p>
    </div>
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
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 shadow-sm">
      <p className="text-caption font-medium text-foreground">{label}</p>
      <p className="text-compact font-semibold tabular-nums text-foreground">{formatAum(value)}</p>
    </div>
  );
}

function renderSalesMixTooltip(props: unknown) {
  return <SalesMixTooltip {...(props as Parameters<typeof SalesMixTooltip>[0])} />;
}

export function BranchReportsPanel({ iconName, title, description }: DistributorPageConfig) {
  const { branchLabel } = useDistributorAuth();
  const Icon = resolveDistributorPageIcon(iconName);

  const summary = useMemo(() => getBranchReportSummary(), []);

  const [distributorFilter, setDistributorFilter] = useState<string | "all">("all");
  const [exceptionFilter, setExceptionFilter] = useState<"all" | BranchComplianceException["status"]>(
    "all",
  );
  const [scheduledReports, setScheduledReports] = useState(DUMMY_BRANCH_SCHEDULED_REPORTS);

  const distributorOptions = DUMMY_BRANCH_AUM_SALES_ROLLUP.map((row) => ({
    value: row.distributorId,
    label: row.name,
  }));

  const filteredKyc = useMemo(() => {
    if (distributorFilter === "all") return DUMMY_BRANCH_KYC_PENDING;
    const name = distributorOptions.find((o) => o.value === distributorFilter)?.label;
    return DUMMY_BRANCH_KYC_PENDING.filter((row) => row.distributorName === name);
  }, [distributorFilter, distributorOptions]);

  const filteredExceptions = useMemo(() => {
    let rows = DUMMY_BRANCH_COMPLIANCE_EXCEPTIONS;
    if (distributorFilter !== "all") {
      const name = distributorOptions.find((o) => o.value === distributorFilter)?.label;
      rows = rows.filter((row) => row.distributorName === name);
    }
    if (exceptionFilter !== "all") {
      rows = rows.filter((row) => row.status === exceptionFilter);
    }
    return rows;
  }, [distributorFilter, distributorOptions, exceptionFilter]);

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

  const filtersDefault = distributorFilter === "all" && exceptionFilter === "all";

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader
        icon={Icon}
        title={title}
        description={`${description} Scope: ${branchLabel}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DistributorMetricCard
          icon={LineChart}
          label="Branch AUM"
          value={formatAum(summary.branchAum)}
          hint="As of last business day"
        />
        <DistributorMetricCard
          icon={TrendingUp}
          label="Net sales (MTD)"
          value={formatAum(summary.netSalesMtd)}
          hint="Inflow minus redemptions"
        />
        <DistributorMetricCard
          icon={Users}
          label="KYC pending"
          value={String(summary.kycPending)}
          hint="Open onboarding cases"
        />
        <DistributorMetricCard
          icon={AlertTriangle}
          label="Compliance exceptions"
          value={String(summary.complianceOpen)}
          hint="Open or in review"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="branch-perf-card overflow-hidden p-0">
          <div className="branch-perf-card__header">
            <div>
              <h3 className="branch-perf-card__title">Branch AUM & net sales</h3>
              <p className="branch-perf-card__desc">Six-month roll-up trend (demo)</p>
            </div>
          </div>
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
          <div className="branch-perf-card__header">
            <div>
              <h3 className="branch-perf-card__title">MTD net sales by distributor</h3>
              <p className="branch-perf-card__desc">Gross sales roll-up for export packs</p>
            </div>
          </div>
          <div
            className="branch-perf-chart h-[260px] w-full min-w-0 px-2 pb-4"
            role="img"
            aria-label="Net sales by distributor"
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

      <TableCard.Root>
        <TableCard.Header
          title="AUM & net sales roll-up"
          description="Per-distributor branch view for HO reporting."
          contentTrailing={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <FileSpreadsheet className="size-3.5" aria-hidden />
                Excel
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <Download className="size-3.5" aria-hidden />
                CSV
              </Button>
            </div>
          }
        />
        <TableCard.Content>
          <Table aria-label="AUM and sales roll-up" size="md" className="min-w-[var(--table-min-width-3xl)]">
            <Table.Header>
              <Table.Head isRowHeader>Distributor</Table.Head>
              <Table.Head className="text-right [&>div]:justify-end">AUM</Table.Head>
              <Table.Head className="text-right [&>div]:justify-end">AUM Δ MTD</Table.Head>
              <Table.Head className="text-right [&>div]:justify-end">Net sales</Table.Head>
              <Table.Head className="text-right [&>div]:justify-end">SIP inflow</Table.Head>
              <Table.Head className="text-right [&>div]:justify-end">Redemptions</Table.Head>
            </Table.Header>
            <Table.Body items={DUMMY_BRANCH_AUM_SALES_ROLLUP}>
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
          </Table>
        </TableCard.Content>
      </TableCard.Root>

      <div className="grid gap-4 xl:grid-cols-2">
        <TableCard.Root>
          <TableCard.Header
            title="KYC pending"
            description="Investors with incomplete onboarding in this branch."
          />
          <div className="border-b border-border px-4 py-3">
            <DistributorTableToolbar
              onClearAll={() => setDistributorFilter("all")}
              clearDisabled={distributorFilter === "all"}
            >
              <StatusFilterSelect
                label="Distributor"
                value={distributorFilter}
                options={distributorOptions}
                onValueChange={setDistributorFilter}
              />
            </DistributorTableToolbar>
          </div>
          <TableCard.Content>
            <Table aria-label="KYC pending" size="md" className="min-w-[var(--table-min-width-xl)]">
              <Table.Header>
                <Table.Head isRowHeader>Client</Table.Head>
                <Table.Head>Distributor</Table.Head>
                <Table.Head>Stage</Table.Head>
                <Table.Head className="text-right [&>div]:justify-end">Days open</Table.Head>
                <Table.Head>Since</Table.Head>
              </Table.Header>
              <Table.Body items={filteredKyc}>
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
            </Table>
          </TableCard.Content>
        </TableCard.Root>

        <TableCard.Root>
          <TableCard.Header
            title="Compliance exceptions"
            description="Items requiring branch or HO action."
          />
          <div className="border-b border-border px-4 py-3">
            <DistributorTableToolbar
              onClearAll={() => {
                setDistributorFilter("all");
                setExceptionFilter("all");
              }}
              clearDisabled={filtersDefault}
            >
              <StatusFilterSelect
                label="Distributor"
                value={distributorFilter}
                options={distributorOptions}
                onValueChange={setDistributorFilter}
              />
              <StatusFilterSelect
                label="Status"
                value={exceptionFilter}
                options={[
                  { value: "Open", label: "Open" },
                  { value: "In review", label: "In review" },
                  { value: "Resolved", label: "Resolved" },
                ]}
                onValueChange={setExceptionFilter}
              />
            </DistributorTableToolbar>
          </div>
          <TableCard.Content>
            <Table
              aria-label="Compliance exceptions"
              size="md"
              className="min-w-[var(--table-min-width-xl)]"
            >
              <Table.Header>
                <Table.Head isRowHeader>Client</Table.Head>
                <Table.Head>Exception</Table.Head>
                <Table.Head>Severity</Table.Head>
                <Table.Head>Status</Table.Head>
              </Table.Header>
              <Table.Body items={filteredExceptions}>
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
            </Table>
          </TableCard.Content>
        </TableCard.Root>
      </div>

      <section className="space-y-3">
        <div className="flex items-start gap-2.5">
          <div
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden
          >
            <Mail className="size-4" />
          </div>
          <div>
            <h2 className="text-compact font-semibold text-foreground">Scheduled email reports to HO</h2>
            <p className="mt-0.5 text-caption text-muted-foreground">
              Automated exports from this branch to head-office distribution lists (demo toggles).
            </p>
          </div>
        </div>

        <ul className="grid gap-3 lg:grid-cols-2">
          {scheduledReports.map((report) => (
            <ScheduledReportCard key={report.id} report={report} onToggle={toggleReport} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function ScheduledReportCard({
  report,
  onToggle,
}: {
  report: BranchScheduledReport;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  return (
    <li>
      <Card className="flex h-full flex-col gap-3 border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-compact font-semibold text-foreground">{report.name}</h3>
              <StatusBadge variant={report.enabled ? "success" : "neutral"}>
                {report.enabled ? "Active" : "Paused"}
              </StatusBadge>
            </div>
            <p className="mt-1 text-caption text-muted-foreground">{report.description}</p>
          </div>
          <Switch
            checked={report.enabled}
            onCheckedChange={(checked) => onToggle(report.id, checked)}
            aria-label={`Enable ${report.name}`}
          />
        </div>
        <dl className="grid gap-2 text-caption sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Frequency</dt>
            <dd className="font-medium text-foreground">{report.frequency}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Recipients</dt>
            <dd className="font-medium text-foreground">{report.recipients.join(", ")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last sent</dt>
            <dd className="text-foreground">
              {report.lastSentAt ? formatDistributorDate(report.lastSentAt) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Next run</dt>
            <dd className="text-foreground">{formatDistributorDate(report.nextRunAt)}</dd>
          </div>
        </dl>
        <div className="mt-auto flex gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <ClipboardList className="size-3.5" aria-hidden />
            Preview
          </Button>
          <Button type="button" variant="ghost" size="sm" className="gap-1.5">
            <Mail className="size-3.5" aria-hidden />
            Send now
          </Button>
        </div>
      </Card>
    </li>
  );
}
