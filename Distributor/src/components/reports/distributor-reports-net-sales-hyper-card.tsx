"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  DISTRIBUTOR_NET_SALES_CHART_PERIODS,
  distributorNetSalesChartPeriodLabel,
  getDistributorNetSalesHyperCardData,
  getDistributorNetSalesTrendForPeriod,
  type DistributorNetSalesChartPeriod,
} from "@/lib/distributor-reports-data";
import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import { DistributorGrowthBadge } from "@/components/ui/distributor-growth-badge";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHART_POINT_WIDTH_PX = 52;
const CHART_MIN_HEIGHT_PX = 84;

function formatLakhHint(amount: number): string {
  const lakhs = amount / 1_00_000;
  const formatted = lakhs.toLocaleString("en-IN", {
    minimumFractionDigits: lakhs >= 10 ? 0 : 1,
    maximumFractionDigits: 1,
  });
  return `₹${formatted}L`;
}

function NetSalesTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const netSales = Number(payload[0]?.value ?? 0);
  return (
    <div className="distributor-reports-net-sales-hyper-card__tooltip">
      <p className="distributor-reports-net-sales-hyper-card__tooltip-label">{label}</p>
      <p className="distributor-reports-net-sales-hyper-card__tooltip-value tabular-nums">
        {formatAum(netSales)}
      </p>
    </div>
  );
}

function renderNetSalesTooltip(props: unknown) {
  return <NetSalesTooltip {...(props as Parameters<typeof NetSalesTooltip>[0])} />;
}

export type DistributorReportsNetSalesHyperCardProps = {
  className?: string;
};

export function DistributorReportsNetSalesHyperCard({
  className,
}: DistributorReportsNetSalesHyperCardProps) {
  const data = useMemo(() => getDistributorNetSalesHyperCardData(), []);
  const [period, setPeriod] = useState<DistributorNetSalesChartPeriod>("6M");
  const plotScrollRef = useRef<HTMLDivElement>(null);
  const fillGradientId = useId().replace(/:/g, "");
  const [plotSize, setPlotSize] = useState({ width: 0, height: 0 });

  const series = useMemo(() => getDistributorNetSalesTrendForPeriod(period), [period]);
  const contentMinWidth = series.length * CHART_POINT_WIDTH_PX;
  const needsScrollX = contentMinWidth > plotSize.width && plotSize.width > 0;
  const innerWidth = needsScrollX ? contentMinWidth : plotSize.width;
  const chartReady = plotSize.width > 0 && plotSize.height > 0;
  const xTickInterval = series.length > 14 ? Math.max(0, Math.floor(series.length / 7) - 1) : 0;

  useEffect(() => {
    const el = plotScrollRef.current;
    if (!el) return;

    const updateSize = () => {
      setPlotSize({
        width: el.clientWidth,
        height: Math.max(el.clientHeight, CHART_MIN_HEIGHT_PX),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = plotScrollRef.current;
    if (!el || !needsScrollX) return;
    el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [needsScrollX, innerWidth, period, series.length]);

  return (
    <article
      className={cn("distributor-reports-net-sales-hyper-card", className)}
      aria-label={data.label}
    >
      <div className="distributor-reports-net-sales-hyper-card__head">
        <div className="distributor-reports-net-sales-hyper-card__copy">
          <DistributorInsightCardHeader eyebrow="Sales book" title={data.label} titleAs="p" />
          <div className="distributor-reports-net-sales-hyper-card__value-row">
            <p className="distributor-reports-net-sales-hyper-card__value tabular-nums">
              {formatAum(data.currentAmount)}
            </p>
            <DistributorGrowthBadge value={data.changePct} showSign={false} />
          </div>
          <p className="distributor-reports-net-sales-hyper-card__compare">
            {formatLakhHint(data.sipInflowMtd)} SIP inflow · {formatLakhHint(data.redemptionsMtd)}{" "}
            redemptions
          </p>
        </div>

        <div
          className="distributor-reports-net-sales-hyper-card__period-tabs"
          role="tablist"
          aria-label="Net sales chart period"
        >
          {DISTRIBUTOR_NET_SALES_CHART_PERIODS.map((option, index) => {
            const selected = option === period;
            return (
              <Fragment key={option}>
                {index > 0 ? (
                  <span
                    className="distributor-reports-net-sales-hyper-card__period-tab-divider"
                    aria-hidden
                  />
                ) : null}
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={cn(
                    "distributor-reports-net-sales-hyper-card__period-tab",
                    selected && "distributor-reports-net-sales-hyper-card__period-tab--active",
                  )}
                  onClick={() => setPeriod(option)}
                >
                  {distributorNetSalesChartPeriodLabel(option)}
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>

      <div
        ref={plotScrollRef}
        className="distributor-reports-net-sales-hyper-card__chart-scroll"
          tabIndex={needsScrollX ? 0 : undefined}
          role={needsScrollX ? "region" : undefined}
          aria-label={
            needsScrollX ? "Net sales trend — scroll horizontally for earlier periods" : undefined
          }
        >
          {chartReady ? (
            <div
              className="distributor-reports-net-sales-hyper-card__chart-inner"
              style={{ width: innerWidth, height: plotSize.height }}
              role="img"
              aria-label={`Net sales trend for ${period}`}
            >
              <ComposedChart
                width={innerWidth}
                height={plotSize.height}
                data={series}
                margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  dy={6}
                  interval={xTickInterval}
                  minTickGap={12}
                />
                <YAxis hide domain={["dataMin - 500000", "dataMax + 250000"]} />
                <Tooltip content={renderNetSalesTooltip} cursor={{ stroke: "var(--chart-1)", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="netSales"
                  stroke="none"
                  fill={`url(#${fillGradientId})`}
                  isAnimationActive
                />
                <Line
                  type="monotone"
                  dataKey="netSales"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  dot={
                    series.length <= 18
                      ? { r: 3, fill: "var(--chart-1)", strokeWidth: 0 }
                      : false
                  }
                  activeDot={{ r: 5, fill: "var(--card)", stroke: "var(--chart-1)", strokeWidth: 2 }}
                  isAnimationActive
                />
              </ComposedChart>
            </div>
          ) : null}
      </div>
    </article>
  );
}
