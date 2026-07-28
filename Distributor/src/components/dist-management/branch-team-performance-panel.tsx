"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Target, TrendingUp, Users } from "lucide-react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { resolveDistributorPageIcon } from "@/components/dashboard/distributor-page-icons";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import { Card } from "@/components/ui/card";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import {
  BRANCH_PERFORMANCE_MONTHS,
  DUMMY_BRANCH_INVESTOR_FUNNEL,
  DUMMY_BRANCH_TARGET_HEATMAP,
  DUMMY_DISTRIBUTOR_TXN_MIX,
  heatmapAttainmentLevel,
} from "@/lib/dummy/branch-team-performance";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHART_BAR_HEIGHT = 260;

type MixChartRow = {
  name: string;
  sip: number;
  lumpsum: number;
};

function MixTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const sip = Number(payload.find((p) => p.dataKey === "sip")?.value ?? 0);
  const lumpsum = Number(payload.find((p) => p.dataKey === "lumpsum")?.value ?? 0);
  const total = sip + lumpsum;
  const sipShare = total > 0 ? Math.round((sip / total) * 100) : 0;
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 shadow-sm">
      <p className="text-caption font-medium text-foreground">{label}</p>
      <p className="mt-1 text-caption text-muted-foreground">
        SIP {formatAum(sip)} · Lumpsum {formatAum(lumpsum)}
      </p>
      <p className="text-compact font-semibold tabular-nums text-foreground">{sipShare}% SIP share</p>
    </div>
  );
}

function renderMixTooltip(props: unknown) {
  return <MixTooltip {...(props as Parameters<typeof MixTooltip>[0])} />;
}

export function BranchTeamPerformancePanel({ iconName, title, description }: DistributorPageConfig) {
  const { branchLabel } = useDistributorAuth();
  const Icon = resolveDistributorPageIcon(iconName);

  const mixChartData = useMemo<MixChartRow[]>(
    () =>
      DUMMY_DISTRIBUTOR_TXN_MIX.map((row) => ({
        name: row.name.split(" ")[0] ?? row.name,
        sip: row.sipAmount,
        lumpsum: row.lumpsumAmount,
      })),
    [],
  );

  const branchSipTotal = DUMMY_DISTRIBUTOR_TXN_MIX.reduce((s, r) => s + r.sipAmount, 0);
  const branchLumpsumTotal = DUMMY_DISTRIBUTOR_TXN_MIX.reduce((s, r) => s + r.lumpsumAmount, 0);
  const branchTotal = branchSipTotal + branchLumpsumTotal;
  const branchSipShare = branchTotal > 0 ? Math.round((branchSipTotal / branchTotal) * 100) : 0;

  const funnelMax = DUMMY_BRANCH_INVESTOR_FUNNEL[0]?.count ?? 1;
  const kycDone = DUMMY_BRANCH_INVESTOR_FUNNEL.find((s) => s.id === "kyc-done")?.count ?? 0;
  const firstTxn = DUMMY_BRANCH_INVESTOR_FUNNEL.find((s) => s.id === "first-txn")?.count ?? 0;
  const kycToTxnPct = kycDone > 0 ? Math.round((firstTxn / kycDone) * 100) : 0;

  const juneCells = DUMMY_BRANCH_TARGET_HEATMAP.filter((c) => c.month === "Jun");
  const branchAttainmentMtd =
    juneCells.length > 0
      ? Math.round(juneCells.reduce((s, c) => s + c.attainmentPct, 0) / juneCells.length)
      : 0;

  const heatmapRows = useMemo(() => {
    const byDist = new Map<string, { name: string; cells: Map<string, number> }>();
    for (const cell of DUMMY_BRANCH_TARGET_HEATMAP) {
      let row = byDist.get(cell.distributorId);
      if (!row) {
        row = { name: cell.distributorName, cells: new Map() };
        byDist.set(cell.distributorId, row);
      }
      row.cells.set(cell.month, cell.attainmentPct);
    }
    return [...byDist.values()];
  }, []);

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader
        icon={Icon}
        title={title}
        description={`${description} Scope: ${branchLabel}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DistributorMetricCard
          icon={Target}
          label="Target attainment (Jun)"
          value={`${branchAttainmentMtd}%`}
          hint="Branch average vs monthly goal"
        />
        <DistributorMetricCard
          icon={TrendingUp}
          label="SIP share"
          value={`${branchSipShare}%`}
          hint={`${formatAum(branchSipTotal)} SIP · ${formatAum(branchLumpsumTotal)} lumpsum`}
        />
        <DistributorMetricCard
          icon={Users}
          label="Active SIP investors"
          value={String(DUMMY_BRANCH_INVESTOR_FUNNEL.at(-1)?.count ?? 0)}
          hint="End of acquisition funnel"
        />
        <DistributorMetricCard
          icon={Users}
          label="KYC → first txn"
          value={`${kycToTxnPct}%`}
          hint={`${firstTxn} of ${kycDone} KYC-complete converted`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="branch-perf-card overflow-hidden p-0">
          <div className="branch-perf-card__header">
            <div>
              <h3 className="branch-perf-card__title">SIP vs lumpsum mix</h3>
              <p className="branch-perf-card__desc">Gross inflow by distributor (demo YTD)</p>
            </div>
          </div>
          <div
            className="branch-perf-chart h-[260px] w-full min-w-0 px-2 pb-2"
            role="img"
            aria-label="SIP versus lumpsum by distributor"
          >
            <ResponsiveContainer width="100%" height={CHART_BAR_HEIGHT} minWidth={0}>
              <BarChart data={mixChartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v) => `${Math.round(Number(v) / 100000)}L`}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <Tooltip content={renderMixTooltip} cursor={{ fill: "var(--muted)", opacity: 0.35 }} />
                <Bar dataKey="sip" stackId="mix" fill="var(--chart-2)" name="SIP" />
                <Bar dataKey="lumpsum" stackId="mix" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Lumpsum" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="branch-perf-legend px-4 pb-4">
            <span className="branch-perf-legend__item">
              <span className="branch-perf-legend__swatch branch-perf-legend__swatch--sip" aria-hidden />
              SIP
            </span>
            <span className="branch-perf-legend__item">
              <span className="branch-perf-legend__swatch branch-perf-legend__swatch--lumpsum" aria-hidden />
              Lumpsum
            </span>
          </div>
        </Card>

        <Card className="branch-perf-card overflow-hidden p-0">
          <div className="branch-perf-card__header">
            <div>
              <h3 className="branch-perf-card__title">Investor acquisition funnel</h3>
              <p className="branch-perf-card__desc">Branch-wide conversion (last 90 days, demo)</p>
            </div>
          </div>
          <div className="branch-perf-funnel px-4 pb-5 pt-1">
            {DUMMY_BRANCH_INVESTOR_FUNNEL.map((stage, index) => {
              const widthPct = Math.max(28, Math.round((stage.count / funnelMax) * 100));
              const prev = DUMMY_BRANCH_INVESTOR_FUNNEL[index - 1];
              const conv = prev && prev.count > 0 ? Math.round((stage.count / prev.count) * 100) : null;
              return (
                <div key={stage.id} className="branch-perf-funnel__stage">
                  <div className="branch-perf-funnel__meta">
                    <p className="branch-perf-funnel__label">{stage.label}</p>
                    <p className="branch-perf-funnel__hint">{stage.hint}</p>
                  </div>
                  <div className="branch-perf-funnel__bar-wrap">
                    <div
                      className="branch-perf-funnel__bar"
                      style={{ width: `${widthPct}%` }}
                      title={`${stage.count} investors`}
                    >
                      <span className="branch-perf-funnel__count">{stage.count}</span>
                    </div>
                    {conv !== null ? (
                      <span className="branch-perf-funnel__conv">{conv}% from prior</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="branch-perf-card overflow-hidden p-0">
        <div className="branch-perf-card__header">
          <div>
            <h3 className="branch-perf-card__title">Monthly target attainment</h3>
            <p className="branch-perf-card__desc">
              Heatmap by distributor — color shows % of monthly sales target
            </p>
          </div>
        </div>
        <div className="branch-perf-heatmap-wrap px-4 pb-5">
          <div className="branch-perf-heatmap" role="table" aria-label="Monthly target attainment heatmap">
            <div className="branch-perf-heatmap__row branch-perf-heatmap__row--head" role="row">
              <span className="branch-perf-heatmap__corner" role="columnheader">
                Distributor
              </span>
              {BRANCH_PERFORMANCE_MONTHS.map((month) => (
                <span key={month} className="branch-perf-heatmap__month" role="columnheader">
                  {month}
                </span>
              ))}
            </div>
            {heatmapRows.map((row) => (
              <div key={row.name} className="branch-perf-heatmap__row" role="row">
                <span className="branch-perf-heatmap__name" role="rowheader">
                  {row.name.split(" ")[0]}
                </span>
                {BRANCH_PERFORMANCE_MONTHS.map((month) => {
                  const pct = row.cells.get(month) ?? 0;
                  const level = heatmapAttainmentLevel(pct);
                  return (
                    <span
                      key={`${row.name}-${month}`}
                      role="cell"
                      className={cn("branch-perf-heatmap__cell", `branch-perf-heatmap__cell--${level}`)}
                      title={`${row.name} · ${month}: ${pct}% of target`}
                    >
                      {pct}%
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="branch-perf-heatmap-legend">
            <span className="branch-perf-heatmap-legend__label">Attainment</span>
            <div className="branch-perf-heatmap-legend__scale">
              <span className="branch-perf-heatmap__cell branch-perf-heatmap__cell--low">&lt;75%</span>
              <span className="branch-perf-heatmap__cell branch-perf-heatmap__cell--mid">75–94%</span>
              <span className="branch-perf-heatmap__cell branch-perf-heatmap__cell--high">95–109%</span>
              <span className="branch-perf-heatmap__cell branch-perf-heatmap__cell--over">110%+</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
