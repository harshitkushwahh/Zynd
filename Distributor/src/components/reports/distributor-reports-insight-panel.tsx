"use client";

import { useMemo, type ReactNode } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info } from "lucide-react";

import { DistributorReportsBookCompositionChart } from "@/components/reports/distributor-reports-book-composition-chart";
import { DistributorReportsInsightTabSkeleton } from "@/components/reports/distributor-reports-insight-tab-skeleton";
import { DistributorReportsInsightTabs } from "@/components/reports/distributor-reports-insight-tabs";
import { useReportsInsightTabSwitch } from "@/components/reports/use-reports-insight-tab-switch";
import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DUMMY_DISTRIBUTOR_REPORT_AUM_MOVEMENT,
  DUMMY_DISTRIBUTOR_REPORT_SIP_TREND,
  getDistributorReportIncentiveCategories,
  getDistributorReportIncentiveTrend,
  type DistributorReportAumMovementRow,
} from "@/lib/distributor-reports-data";
import {
  distributorReportsInsightTabTitle,
  type DistributorReportsInsightTabId,
} from "@/lib/distributor-reports-insight-tabs";
import { formatAum } from "@/lib/format";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 300;

const INCENTIVE_CATEGORY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const INSIGHT_CHART_AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 10 };

const INSIGHT_BAR_CHART_CURSOR = {
  fill: "color-mix(in srgb, var(--muted) 35%, transparent)",
};

function ChartCard({
  eyebrow,
  title,
  info,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  info: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("distributor-reports-insight-chart", className)}>
      <div className="distributor-reports-insight-chart__head">
        <DistributorInsightCardHeader
          eyebrow={eyebrow}
          title={title}
          titleAs="h3"
          trailing={
            <UiTooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="distributor-insight-card-header__info distributor-reports-insight-chart__info"
                    aria-label={`About ${title}`}
                  >
                    <Info className="size-3.5" strokeWidth={2.25} aria-hidden />
                  </button>
                }
              />
              <TooltipContent
                side="left"
                align="end"
                className="distributor-reports-insight-chart__info-content max-w-[14rem] text-left leading-snug"
              >
                {info}
              </TooltipContent>
            </UiTooltip>
          }
        />
      </div>
      <div className="distributor-reports-insight-chart__plot">{children}</div>
    </div>
  );
}

type InsightPlotTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{
    name?: string;
    value?: number;
    dataKey?: string;
    payload?: AumMovementBar;
  }>;
  valueFormatter?: (value: number, name?: string) => string;
};

function InsightPlotTooltip({
  active,
  label,
  payload,
  valueFormatter,
}: InsightPlotTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="distributor-reports-insight-chart__plot-tooltip">
      {label ? <p className="distributor-reports-insight-chart__plot-tooltip-label">{label}</p> : null}
      <ul className="distributor-reports-insight-chart__plot-tooltip-list">
        {payload.map((entry) => {
          const value = Number(entry.value ?? 0);
          const name = entry.name ?? entry.dataKey ?? "Value";
          const formatted = valueFormatter ? valueFormatter(value, String(name)) : String(value);
          return (
            <li key={`${name}-${entry.dataKey}`} className="distributor-reports-insight-chart__plot-tooltip-row">
              <span>{name}</span>
              <span className="tabular-nums">{formatted}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function renderInsightPlotTooltip(
  valueFormatter?: (value: number, name?: string) => string,
) {
  return function InsightPlotTooltipRenderer(props: unknown) {
    return (
      <InsightPlotTooltip
        {...(props as InsightPlotTooltipProps)}
        valueFormatter={valueFormatter}
      />
    );
  };
}

type AumMovementBar = DistributorReportAumMovementRow & {
  barValue: number;
};

const AUM_MOVEMENT_CHART_DATA: AumMovementBar[] = DUMMY_DISTRIBUTOR_REPORT_AUM_MOVEMENT.map((row) => ({
  ...row,
  barValue: Math.abs(row.amount),
}));

function AumMovementPlotTooltip({ active, label, payload }: InsightPlotTooltipProps) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as AumMovementBar | undefined;
  if (!row) return null;

  return (
    <div className="distributor-reports-insight-chart__plot-tooltip">
      {label ? <p className="distributor-reports-insight-chart__plot-tooltip-label">{label}</p> : null}
      <ul className="distributor-reports-insight-chart__plot-tooltip-list">
        <li className="distributor-reports-insight-chart__plot-tooltip-row">
          <span>Change</span>
          <span className="tabular-nums">{formatAum(Math.abs(row.amount))}</span>
        </li>
      </ul>
    </div>
  );
}

function renderAumMovementPlotTooltip(props: unknown) {
  return <AumMovementPlotTooltip {...(props as InsightPlotTooltipProps)} />;
}

function aumMovementBarFill(entry: DistributorReportAumMovementRow) {
  if (entry.amount < 0) return "var(--destructive)";
  if (entry.id === "closing" || entry.id === "opening") return "var(--primary)";
  return "var(--chart-2)";
}

function BookQualityCharts() {
  return (
    <>
      <ChartCard
        eyebrow="Book quality"
        title="Book composition"
        info={ZYND_MITRA_COPY.bookSchemeMixInfo}
      >
        <DistributorReportsBookCompositionChart chartHeight={CHART_HEIGHT} />
      </ChartCard>

      <ChartCard
        eyebrow="Book quality"
        title="AUM movement"
        info="Breakdown of what drove book change this month — opening balance, flows, market impact, and closing AUM."
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
          <BarChart
            data={AUM_MOVEMENT_CHART_DATA}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={INSIGHT_CHART_AXIS_TICK}
              interval={0}
            />
            <YAxis hide domain={[0, (max: number) => Math.ceil(max * 1.04)]} />
            <Tooltip content={renderAumMovementPlotTooltip} cursor={INSIGHT_BAR_CHART_CURSOR} />
            <Bar dataKey="barValue" name="Change" radius={[4, 4, 0, 0]}>
              {AUM_MOVEMENT_CHART_DATA.map((entry) => (
                <Cell key={entry.id} fill={aumMovementBarFill(entry)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}

function SipBusinessCharts() {
  return (
    <>
      <ChartCard
        eyebrow="SIP business"
        title="SIP inflow trend"
        info="Monthly SIP debit amount collected across active mandates in your book over the last six months."
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
          <ComposedChart
            data={DUMMY_DISTRIBUTOR_REPORT_SIP_TREND}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="distributor-sip-inflow-wave-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={INSIGHT_CHART_AXIS_TICK} />
            <YAxis hide domain={["dataMin - 500000", "dataMax + 250000"]} />
            <Tooltip
              content={renderInsightPlotTooltip((value) => formatAum(value))}
              cursor={{ stroke: "var(--chart-2)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="inflow"
              stroke="none"
              fill="url(#distributor-sip-inflow-wave-fill)"
              isAnimationActive
            />
            <Line
              type="monotone"
              dataKey="inflow"
              name="Inflow"
              stroke="var(--chart-2)"
              strokeWidth={2.25}
              dot={{ r: 2.5, fill: "var(--chart-2)", strokeWidth: 0 }}
              activeDot={{ r: 4, fill: "var(--chart-2)", stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        eyebrow="SIP business"
        title="Active SIP count"
        info={ZYND_MITRA_COPY.bookSipMandatesInfo}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
          <BarChart data={DUMMY_DISTRIBUTOR_REPORT_SIP_TREND} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={INSIGHT_CHART_AXIS_TICK} />
            <YAxis hide domain={["dataMin - 8", "dataMax + 8"]} />
            <Tooltip
              content={renderInsightPlotTooltip((value) => `${value} SIPs`)}
              cursor={INSIGHT_BAR_CHART_CURSOR}
            />
            <Bar dataKey="activeSips" name="SIPs" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}

function IncentiveCharts() {
  const trend = useMemo(() => getDistributorReportIncentiveTrend(), []);
  const categories = useMemo(() => getDistributorReportIncentiveCategories(), []);

  return (
    <>
      <ChartCard
        eyebrow="Incentives"
        title="Incentive earned vs paid"
        info="Six-month view of incentive earned in the period versus amounts paid out to your account."
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
          <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={INSIGHT_CHART_AXIS_TICK} />
            <YAxis hide />
            <Tooltip content={renderInsightPlotTooltip((value) => formatAum(value))} />
            <Line type="monotone" dataKey="earned" name="Earned" stroke="var(--primary)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="paid" name="Paid" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        eyebrow="Incentives"
        title="Incentive by category"
        info="Share of incentive earned month-to-date split by product category."
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
          <BarChart
            data={categories}
            layout="vertical"
            margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={92}
              tickLine={false}
              axisLine={false}
              tick={INSIGHT_CHART_AXIS_TICK}
            />
            <Tooltip
              content={renderInsightPlotTooltip((value) => formatAum(value))}
              cursor={INSIGHT_BAR_CHART_CURSOR}
            />
            <Bar dataKey="amount" name="Earned" radius={[0, 4, 4, 0]}>
              {categories.map((entry, index) => (
                <Cell
                  key={entry.id}
                  fill={INCENTIVE_CATEGORY_COLORS[index % INCENTIVE_CATEGORY_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}

const TAB_PANELS: Record<DistributorReportsInsightTabId, () => ReactNode> = {
  book: BookQualityCharts,
  sip: SipBusinessCharts,
  incentives: IncentiveCharts,
};

export function DistributorReportsInsightPanel() {
  const { activeTab, setActiveTab, isSwitching, showPanelSkeleton } = useReportsInsightTabSwitch();

  const PanelContent = TAB_PANELS[activeTab];

  return (
    <section className="distributor-reports-insight" aria-label="Report insights">
      <div
        className={cn(
          "distributor-reports-insight__toolbar",
          isSwitching && "distributor-reports-insight__toolbar--switching",
        )}
      >
        <h2
          key={activeTab}
          className={cn(
            "distributor-reports-insight__title",
            !showPanelSkeleton && "distributor-reports-insight__title--enter",
          )}
        >
          {distributorReportsInsightTabTitle(activeTab)}
        </h2>
        <DistributorReportsInsightTabs value={activeTab} onChange={setActiveTab} busy={isSwitching} />
      </div>

      {showPanelSkeleton ? (
        <DistributorReportsInsightTabSkeleton />
      ) : (
        <div
          key={activeTab}
          id={`distributor-reports-insight-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`distributor-reports-insight-tab-${activeTab}`}
          className={cn(
            "distributor-reports-insight__content distributor-reports-insight__panel--enter",
            isSwitching && "distributor-reports-insight__panel--pending",
          )}
        >
          <PanelContent />
        </div>
      )}
    </section>
  );
}
