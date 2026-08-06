"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { DistributorChartTooltip } from "@/components/ui/distributor-chart-tooltip";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  getPortfolioChartSeries,
  PORTFOLIO_CHART_PERIODS,
  portfolioChartPeriodSelectLabel,
  type PortfolioChartPeriod,
  type PortfolioChartPoint,
} from "@/lib/client-portfolio-chart-data";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHART_POINT_WIDTH_PX = 56;
const CHART_X_AXIS_HEIGHT = 24;

type ChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    value?: number | string;
    dataKey?: string;
    payload?: PortfolioChartPoint;
  }>;
  label?: string | number;
};

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const copy = DISTRIBUTOR_CLIENT_COPY.portfolio;
  const byKey = Object.fromEntries(
    payload.map((entry) => [entry.dataKey ?? "value", Number(entry.value ?? 0)]),
  );

  return (
    <DistributorChartTooltip>
      {label ? <p className="text-caption text-muted-foreground">{label}</p> : null}
      {byKey.invested != null ? (
        <p className="text-compact tabular-nums text-foreground">
          <span className="text-muted-foreground">{copy.invested}: </span>
          {formatAum(byKey.invested)}
        </p>
      ) : null}
      {byKey.value != null ? (
        <p className="text-compact font-semibold tabular-nums text-foreground">
          <span className="font-normal text-muted-foreground">{copy.currentValue}: </span>
          {formatAum(byKey.value)}
        </p>
      ) : null}
    </DistributorChartTooltip>
  );
}

function renderChartTooltip(props: unknown) {
  return <ChartTooltip {...(props as ChartTooltipProps)} />;
}

function yDomain(points: PortfolioChartPoint[]): [number, number] {
  const values = points.flatMap((point) => [point.value, point.invested]);
  const min = Math.min(...values);
  const max = Math.max(...values, 1);
  const pad = (max - min) * 0.1 || max * 0.1;
  return [Math.max(0, min - pad), max + pad];
}

type ClientPortfolioValueChartProps = {
  clientId: string;
  currentValue: number;
  investedAmount: number;
  className?: string;
  hideToolbar?: boolean;
  period?: PortfolioChartPeriod;
  onPeriodChange?: (period: PortfolioChartPeriod) => void;
  refreshKey?: number;
  onRefresh?: () => void;
};

export function usePortfolioValueChartControls(initialPeriod: PortfolioChartPeriod = "1Y") {
  const [period, setPeriod] = useState<PortfolioChartPeriod>(initialPeriod);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);
  return { period, setPeriod, refreshKey, refresh };
}

type ClientPortfolioChartToolbarProps = {
  period: PortfolioChartPeriod;
  onPeriodChange: (period: PortfolioChartPeriod) => void;
  onRefresh?: () => void;
  className?: string;
  layout?: "default" | "inline";
  showLegend?: boolean;
  showRefresh?: boolean;
};

export function ClientPortfolioChartToolbar({
  period,
  onPeriodChange,
  onRefresh,
  className,
  layout = "default",
  showLegend = true,
  showRefresh = true,
}: ClientPortfolioChartToolbarProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.portfolio;

  return (
    <div
      className={cn(
        "distributor-client-portfolio-chart__toolbar",
        layout === "inline" && "distributor-client-portfolio-chart__toolbar--inline",
        !showLegend && !showRefresh && "distributor-client-portfolio-chart__toolbar--period-only",
        className,
      )}
    >
      <Select
        value={period}
        onValueChange={(value) => {
          if (value) onPeriodChange(value as PortfolioChartPeriod);
        }}
      >
        <SelectTrigger
          size="sm"
          className="distributor-client-portfolio-chart__period-trigger min-w-[7.5rem] rounded-full border-border bg-muted/40"
          aria-label="Chart period"
        >
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent align="start">
          {PORTFOLIO_CHART_PERIODS.map((option) => (
            <SelectItem key={option} value={option}>
              {portfolioChartPeriodSelectLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showLegend ? (
        <div className="distributor-client-portfolio-chart__legend">
          <StatusBadge variant="neutral">{copy.invested}</StatusBadge>
          <StatusBadge variant="info">{copy.currentValue}</StatusBadge>
        </div>
      ) : null}

      {showRefresh ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="distributor-client-portfolio-chart__refresh shrink-0 text-muted-foreground"
          aria-label="Refresh portfolio chart"
          title="Refresh chart snapshot"
          onClick={onRefresh}
        >
          <RotateCw className="size-4" strokeWidth={2.25} />
        </Button>
      ) : null}
    </div>
  );
}

export function ClientPortfolioValueChart({
  clientId,
  currentValue,
  investedAmount,
  className,
  hideToolbar = false,
  period: periodProp,
  onPeriodChange,
  refreshKey: refreshKeyProp,
  onRefresh: onRefreshProp,
}: ClientPortfolioValueChartProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.portfolio;
  const [periodInternal, setPeriodInternal] = useState<PortfolioChartPeriod>("1Y");
  const [refreshKeyInternal, setRefreshKeyInternal] = useState(0);
  const period = periodProp ?? periodInternal;
  const setPeriod = onPeriodChange ?? setPeriodInternal;
  const refreshKey = refreshKeyProp ?? refreshKeyInternal;
  const [plotLayout, setPlotLayout] = useState({ width: 0, height: 0 });
  const valueGradientId = useId().replace(/:/g, "");
  const investedGradientId = `${valueGradientId}-invested`;
  const chartAnchor = currentValue ?? 0;
  const chartInvested =
    investedAmount > 0 ? investedAmount : Math.round(chartAnchor * 0.82);

  const series = useMemo(
    () => getPortfolioChartSeries(clientId, chartAnchor, period, chartInvested),
    [chartAnchor, chartInvested, clientId, period, refreshKey],
  );

  const domain = useMemo(() => yDomain(series), [series]);
  const plotScrollRef = useRef<HTMLDivElement>(null);
  const axisScrollRef = useRef<HTMLDivElement>(null);

  const contentMinWidth = series.length * CHART_POINT_WIDTH_PX;
  const innerWidth = Math.max(plotLayout.width, contentMinWidth);
  const canScrollX = contentMinWidth > plotLayout.width && plotLayout.width > 0;
  const chartReady = plotLayout.width > 0 && plotLayout.height > 0;

  const syncAxisScroll = useCallback(() => {
    const plot = plotScrollRef.current;
    const axis = axisScrollRef.current;
    if (plot && axis) {
      axis.scrollLeft = plot.scrollLeft;
    }
  }, []);

  useEffect(() => {
    const el = plotScrollRef.current;
    if (!el) return;

    const updateSize = () => {
      setPlotLayout({ width: el.clientWidth, height: el.clientHeight });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = plotScrollRef.current;
    const axis = axisScrollRef.current;
    if (!el || !canScrollX) return;
    el.scrollLeft = el.scrollWidth - el.clientWidth;
    if (axis) {
      axis.scrollLeft = el.scrollLeft;
    }
  }, [canScrollX, innerWidth, period, refreshKey]);

  const onRefresh = useCallback(() => {
    if (onRefreshProp) {
      onRefreshProp();
      return;
    }
    setRefreshKeyInternal((key) => key + 1);
  }, [onRefreshProp]);

  return (
    <article
      className={cn("distributor-client-portfolio-chart", className)}
      aria-label={copy.chartTitle}
    >
      {!hideToolbar ? (
        <ClientPortfolioChartToolbar
          period={period}
          onPeriodChange={setPeriod}
          onRefresh={onRefresh}
        />
      ) : null}

      <div className="distributor-client-portfolio-chart__plot-body">
        <div className="distributor-client-portfolio-chart__plot-stack">
          <div
            ref={plotScrollRef}
            className="distributor-client-portfolio-chart__plot-scroll"
            tabIndex={canScrollX ? 0 : undefined}
            role={canScrollX ? "region" : undefined}
            aria-label={
              canScrollX
                ? `${copy.chartTitle} — scroll horizontally for earlier periods`
                : undefined
            }
            onScroll={syncAxisScroll}
          >
            {chartReady ? (
              <div
                className="distributor-client-portfolio-chart__plot-inner"
                style={{ width: innerWidth }}
              >
                <AreaChart
                  key={`plot-${innerWidth}-${plotLayout.height}-${period}`}
                  width={innerWidth}
                  height={plotLayout.height}
                  data={series}
                  margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id={investedGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c4b5a0" stopOpacity={0.38} />
                      <stop offset="100%" stopColor="#c4b5a0" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id={valueGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1e3a38" stopOpacity={0.42} />
                      <stop offset="100%" stopColor="#1e3a38" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                  <YAxis domain={domain} hide width={0} />
                  <Tooltip
                    content={renderChartTooltip}
                    cursor={{
                      stroke: "var(--border)",
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                    wrapperStyle={{ zIndex: 1 }}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="invested"
                    stroke="#8a8175"
                    strokeWidth={1.75}
                    fill={`url(#${investedGradientId})`}
                    dot={false}
                    activeDot={{
                      r: 3.5,
                      strokeWidth: 2,
                      fill: "var(--card)",
                      stroke: "#8a8175",
                    }}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="value"
                    stroke="#1e3a38"
                    strokeWidth={2}
                    fill={`url(#${valueGradientId})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: "var(--card)", stroke: "#1e3a38" }}
                  />
                </AreaChart>
              </div>
            ) : null}
          </div>

          <div
            ref={axisScrollRef}
            className="distributor-client-portfolio-chart__plot-axis"
            aria-hidden
          >
            {chartReady ? (
              <div
                className="distributor-client-portfolio-chart__plot-inner"
                style={{ width: innerWidth }}
              >
                <AreaChart
                  key={`axis-${innerWidth}-${period}`}
                  width={innerWidth}
                  height={CHART_X_AXIS_HEIGHT}
                  data={series}
                  margin={{ top: 0, right: 12, left: 4, bottom: 0 }}
                >
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval={canScrollX ? 0 : "preserveStartEnd"}
                    minTickGap={canScrollX ? 32 : 24}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  />
                  <YAxis hide domain={[0, 1]} width={0} />
                </AreaChart>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
