"use client";

import Link from "next/link";
import { useId, useMemo } from "react";
import { ArrowUpRight, Building2, Home, MapPin } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import {
  DUMMY_DISTRIBUTOR_JOB_COMPENSATION,
  DUMMY_DISTRIBUTOR_WORK_ATTENDANCE,
  getDistributorWorkAttendanceChartData,
  getDistributorWorkAttendanceSummary,
  type DistributorWorkAttendanceChartPoint,
} from "@/lib/dummy/distributor-job-dashboard";
import { cn } from "@/lib/utils";

const ATTENDANCE_DETAIL_HREF = "/dashboard/payouts/attendance";

type AttendanceChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DistributorWorkAttendanceChartPoint }>;
};

function AttendanceChartTooltip({ active, payload }: AttendanceChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="distributor-work-attendance-card__tooltip">
      <p className="distributor-work-attendance-card__tooltip-value tabular-nums">
        {point.hours > 0 ? `${point.hours.toFixed(1)}h` : "—"}
      </p>
    </div>
  );
}

function renderAttendanceChartTooltip(props: unknown) {
  return <AttendanceChartTooltip {...(props as AttendanceChartTooltipProps)} />;
}

type DistributorWorkAttendanceCardProps = {
  className?: string;
  variant?: "default" | "sidebar";
};

function WorkAttendanceSidebarCard({
  className,
  summary,
  chartData,
  periodLabel,
}: {
  className?: string;
  summary: ReturnType<typeof getDistributorWorkAttendanceSummary>;
  chartData: ReturnType<typeof getDistributorWorkAttendanceChartData>;
  periodLabel: string;
}) {
  const lineStroke = "color-mix(in srgb, var(--primary) 82%, #3d6b5e)";

  const workTypePills = [
    { label: "Office", value: summary.officeDays, icon: Building2, className: "distributor-job-sidebar-chip--office" },
    { label: "Site", value: summary.clientSiteDays, icon: MapPin, className: "distributor-job-sidebar-chip--site" },
    { label: "Home", value: summary.homeDays, icon: Home, className: "distributor-job-sidebar-chip--home" },
  ];

  return (
    <Link
      href={ATTENDANCE_DETAIL_HREF}
      className={cn("distributor-job-sidebar-card distributor-job-sidebar-card--attendance", className)}
      aria-label="Work attendance this month"
    >
      <div className="distributor-job-sidebar-card__head">
        <div>
          <p className="distributor-job-sidebar-card__eyebrow">{periodLabel}</p>
          <h2 className="distributor-job-sidebar-card__title">Work attendance</h2>
        </div>
        <span className="distributor-job-sidebar-card__action" aria-hidden>
          <ArrowUpRight className="size-3.5" strokeWidth={2.25} />
        </span>
      </div>

      <div className="distributor-job-sidebar-card__hero tabular-nums">
        <span className="distributor-job-sidebar-card__hero-value">{summary.totalHours}h</span>
        <span className="distributor-job-sidebar-card__hero-meta">{summary.weightedHours}h weighted</span>
      </div>

      <div className="distributor-job-sidebar-card__body">
        <div className="distributor-job-sidebar-card__chart" role="img" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 4, left: 4, bottom: 2 }}>
              <XAxis dataKey="label" hide />
              <Tooltip cursor={false} content={renderAttendanceChartTooltip} />
              <Line
                type="monotone"
                dataKey="hours"
                stroke={lineStroke}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: lineStroke, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="distributor-job-sidebar-card__footer-chips">
          {workTypePills.map((pill) => (
            <span key={pill.label} className={cn("distributor-job-sidebar-chip", pill.className)}>
              <pill.icon className="size-3" strokeWidth={2.25} aria-hidden />
              <span className="distributor-job-sidebar-chip__label">{pill.label}</span>
              <span className="distributor-job-sidebar-chip__value tabular-nums">{pill.value}</span>
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export function DistributorWorkAttendanceCard({
  className,
  variant = "default",
}: DistributorWorkAttendanceCardProps) {
  const gradientId = useId().replace(/:/g, "");
  const rows = DUMMY_DISTRIBUTOR_WORK_ATTENDANCE;
  const summary = useMemo(() => getDistributorWorkAttendanceSummary(rows), [rows]);
  const chartData = useMemo(() => getDistributorWorkAttendanceChartData(rows), [rows]);
  const periodLabel = DUMMY_DISTRIBUTOR_JOB_COMPENSATION.periodLabel;

  if (variant === "sidebar") {
    return (
      <WorkAttendanceSidebarCard
        className={className}
        summary={summary}
        chartData={chartData}
        periodLabel={periodLabel}
      />
    );
  }

  return (
    <article className={cn("distributor-work-attendance-card", className)} aria-label="Work attendance this month">
      <div className="distributor-work-attendance-card__head">
        <div className="distributor-work-attendance-card__copy">
          <p className="distributor-work-attendance-card__eyebrow">{periodLabel} · Payroll input</p>
          <h2 className="distributor-work-attendance-card__title">Work attendance</h2>
          <p className="distributor-work-attendance-card__description">
            Daily clock-in by work type — drives variable pay and field allowances.
          </p>
        </div>
      </div>

      <div className="distributor-work-attendance-card__metrics">
        <div className="distributor-work-attendance-card__metric">
          <p className="distributor-work-attendance-card__metric-label">Hours logged</p>
          <p className="distributor-work-attendance-card__metric-value tabular-nums">{summary.totalHours}h</p>
          <p className="distributor-work-attendance-card__metric-hint tabular-nums">
            {summary.weightedHours}h weighted
          </p>
        </div>
        <div className="distributor-work-attendance-card__metric">
          <p className="distributor-work-attendance-card__metric-label">Office</p>
          <p className="distributor-work-attendance-card__metric-value tabular-nums">{summary.officeDays}</p>
          <p className="distributor-work-attendance-card__metric-hint">days</p>
        </div>
        <div className="distributor-work-attendance-card__metric">
          <p className="distributor-work-attendance-card__metric-label">Client site</p>
          <p className="distributor-work-attendance-card__metric-value tabular-nums">{summary.clientSiteDays}</p>
          <p className="distributor-work-attendance-card__metric-hint">1.15× factor</p>
        </div>
        <div className="distributor-work-attendance-card__metric">
          <p className="distributor-work-attendance-card__metric-label">Home</p>
          <p className="distributor-work-attendance-card__metric-value tabular-nums">{summary.homeDays}</p>
          <p className="distributor-work-attendance-card__metric-hint">0.95× factor</p>
        </div>
      </div>

      <Link
        href={ATTENDANCE_DETAIL_HREF}
        className="distributor-work-attendance-card__chart-link"
        aria-label="Open attendance records for July 2026"
      >
        <div className="distributor-work-attendance-card__chart" role="img" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.06} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                interval={0}
              />
              <Tooltip cursor={{ fill: "color-mix(in srgb, var(--muted) 35%, transparent)" }} content={renderAttendanceChartTooltip} />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={18}>
                {chartData.map((point) => (
                  <Cell key={point.id} fill={point.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <span className="distributor-work-attendance-card__chart-hint">
          <span>Tap chart for daily records</span>
          <ArrowUpRight className="size-3.5" strokeWidth={2.25} aria-hidden />
        </span>
      </Link>

      <Link href={ATTENDANCE_DETAIL_HREF} className="distributor-work-attendance-card__cta">
        <span>View attendance records</span>
        <ArrowUpRight className="size-4" strokeWidth={2.25} aria-hidden />
      </Link>
    </article>
  );
}
