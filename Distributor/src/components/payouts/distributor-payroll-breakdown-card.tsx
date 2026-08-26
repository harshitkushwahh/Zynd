"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Info, Layers, Plus, Target, TrendingUp } from "lucide-react";
import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

import type {
  DistributorJobCompensation,
  DistributorJobPerformanceCalc,
  DistributorPayrollPromotion,
} from "@/lib/distributor-job-dashboard-data";
import {
  DUMMY_DISTRIBUTOR_JOB_COMPENSATION,
  DUMMY_DISTRIBUTOR_JOB_PERFORMANCE,
  DUMMY_DISTRIBUTOR_PAYROLL_PROMOTION,
  getSalaryPaymentStatusLabel,
  hasPayrollPromotion,
  hasPerformanceIncentivePlan,
  shouldShowPayrollWaitingBadge,
} from "@/lib/distributor-job-dashboard-data";
import { formatAum, formatPortfolioMetricAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

const PAYROLL_HISTORY_HREF = "/dashboard/payouts/payroll";
const INCENTIVE_RING_TRACK = "color-mix(in srgb, var(--border) 65%, var(--card))";
const INCENTIVE_RING_FILL = "#3d6b5e";

type PerformanceIncentiveData = typeof DUMMY_DISTRIBUTOR_JOB_PERFORMANCE;
type IncentiveChipId = "target" | "achieved" | "slab" | "adjustment";

const INCENTIVE_CHIP_ICONS = {
  target: Target,
  achieved: TrendingUp,
  slab: Layers,
  adjustment: Plus,
} as const;

type IncentiveChipConfig = {
  id: IncentiveChipId;
  label: string;
  value: number;
  ringPct: number;
  ringPrimary: string;
  ringSecondary: string;
};

function buildIncentiveChips(perf: PerformanceIncentiveData): IncentiveChipConfig[] {
  const slabPct = Math.min(100, Math.round((perf.calculatedIncentive / perf.incentiveSlab) * 100));
  const adjustmentPct = Math.min(
    100,
    Math.max(12, Math.round((perf.adjustments / perf.finalIncentive) * 100)),
  );

  return [
    {
      id: "target",
      label: "Target",
      value: perf.netSalesTarget,
      ringPct: 100,
      ringPrimary: "100%",
      ringSecondary: formatAmount(perf.netSalesTarget),
    },
    {
      id: "achieved",
      label: "Achieved",
      value: perf.netSalesAchieved,
      ringPct: perf.achievementPct,
      ringPrimary: `${perf.achievementPct}%`,
      ringSecondary: formatAmount(perf.netSalesAchieved),
    },
    {
      id: "slab",
      label: "Slab",
      value: perf.incentiveSlab,
      ringPct: slabPct,
      ringPrimary: `${slabPct}%`,
      ringSecondary: formatAmount(perf.incentiveSlab),
    },
    {
      id: "adjustment",
      label: "Adjustment",
      value: perf.adjustments,
      ringPct: adjustmentPct,
      ringPrimary: `+${formatAmount(perf.adjustments)}`,
      ringSecondary: formatAmount(perf.finalIncentive),
    },
  ];
}

function PerformanceIncentiveEmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "distributor-compensation-breakdown-card__incentive-empty",
        compact && "distributor-compensation-breakdown-card__incentive-empty--compact",
      )}
    >
      <Target className="size-4 text-muted-foreground/70" strokeWidth={1.75} aria-hidden />
      <div>
        <p className="distributor-compensation-breakdown-card__incentive-empty-title">
          No incentive plan for this period
        </p>
        <p className="distributor-compensation-breakdown-card__incentive-empty-description">
          Targets and slabs appear once your branch assigns a sales incentive plan.
        </p>
      </div>
    </div>
  );
}

function PerformanceIncentivePanel({
  perf,
  variant = "default",
}: {
  perf: PerformanceIncentiveData;
  variant?: "default" | "dashboard";
}) {
  const isDashboard = variant === "dashboard";
  const hasPlan = hasPerformanceIncentivePlan(perf);
  const chips = useMemo(() => buildIncentiveChips(perf), [perf]);
  const [activeChipId, setActiveChipId] = useState<IncentiveChipId>("achieved");
  const activeChip = chips.find((chip) => chip.id === activeChipId) ?? chips[1];
  const chartData = useMemo(
    () => [{ name: activeChip.id, value: activeChip.ringPct }],
    [activeChip.id, activeChip.ringPct],
  );

  if (!hasPlan) {
    return <PerformanceIncentiveEmptyState compact={isDashboard} />;
  }

  return (
    <div
      className={cn(
        isDashboard
          ? "distributor-compensation-breakdown-card__incentive"
          : "distributor-compensation-breakdown-card__calc",
      )}
      aria-label={isDashboard ? "Performance incentive breakdown" : undefined}
    >
      {!isDashboard ? (
        <div className="distributor-compensation-breakdown-card__incentive-head">
          <p className="distributor-compensation-breakdown-card__calc-title">Performance incentive</p>
        </div>
      ) : null}

      <div
        className={cn(
          isDashboard
            ? "distributor-compensation-breakdown-card__incentive-body"
            : "distributor-compensation-breakdown-card__calc-body",
        )}
      >
        {!isDashboard ? (
          <div
            className="distributor-compensation-breakdown-card__calc-ring"
            role="img"
            aria-label={`${activeChip.label}: ${activeChip.ringPrimary}, ${activeChip.ringSecondary}`}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <RadialBarChart
                key={activeChip.id}
                cx="50%"
                cy="50%"
                innerRadius="74%"
                outerRadius="100%"
                barSize={10}
                data={chartData}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  background={{ fill: INCENTIVE_RING_TRACK }}
                  dataKey="value"
                  cornerRadius={999}
                  fill={INCENTIVE_RING_FILL}
                  isAnimationActive
                />
              </RadialBarChart>
            </ResponsiveContainer>

            <div className="distributor-compensation-breakdown-card__calc-ring-center">
              <span className="distributor-compensation-breakdown-card__calc-ring-pct tabular-nums">
                {activeChip.ringPrimary}
              </span>
              <span
                className="distributor-compensation-breakdown-card__calc-ring-amount tabular-nums"
                title={formatAum(activeChip.value)}
              >
                {activeChip.ringSecondary}
              </span>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            isDashboard
              ? "distributor-compensation-breakdown-card__incentive-values distributor-compensation-breakdown-card__incentive-values--chip-grid"
              : "distributor-compensation-breakdown-card__calc-chips-col",
          )}
        >
          {chips.map((chip) => {
            const isActive = !isDashboard && chip.id === activeChipId;

            if (isDashboard) {
              const Icon = INCENTIVE_CHIP_ICONS[chip.id];

              return (
                <div
                  key={chip.id}
                  className={cn(
                    "distributor-compensation-breakdown-card__incentive-chip",
                    `distributor-compensation-breakdown-card__incentive-chip--${chip.id}`,
                  )}
                >
                  <span className="distributor-compensation-breakdown-card__incentive-chip-icon" aria-hidden>
                    <Icon className="size-3" strokeWidth={2.25} />
                  </span>
                  <span className="distributor-compensation-breakdown-card__incentive-chip-copy">
                    <span className="distributor-compensation-breakdown-card__incentive-chip-label">
                      {chip.label}
                    </span>
                    <span
                      className="distributor-compensation-breakdown-card__incentive-chip-value tabular-nums"
                      title={formatAum(chip.value)}
                    >
                      {chip.id === "adjustment" ? `+${formatAmount(chip.value)}` : formatAmount(chip.value)}
                    </span>
                  </span>
                </div>
              );
            }

            return (
              <button
                key={chip.id}
                type="button"
                className={cn(
                  "distributor-compensation-breakdown-card__calc-chip",
                  isActive && "distributor-compensation-breakdown-card__calc-chip--active",
                )}
                aria-pressed={isActive}
                onClick={() => setActiveChipId(chip.id)}
              >
                <span className="distributor-compensation-breakdown-card__calc-chip-label">{chip.label}</span>
                <span
                  className="distributor-compensation-breakdown-card__calc-chip-value tabular-nums"
                  title={formatAum(chip.value)}
                >
                  {chip.id === "adjustment" ? `+${formatAmount(chip.value)}` : formatAmount(chip.value)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function parsePromotionLabel(label: string): { kind: string; grade: string } {
  const [kind, grade] = label.split(" · ");
  return {
    kind: kind?.trim() || "Promotion",
    grade: grade?.trim() || label,
  };
}

function formatPromotionEffectiveDate(effectiveLabel: string): string {
  return effectiveLabel.replace(/^Effective\s+/i, "").trim();
}

function PayrollPromotionStrip({
  promotion,
  compact = false,
  banner = false,
  panel = false,
}: {
  promotion: typeof DUMMY_DISTRIBUTOR_PAYROLL_PROMOTION;
  compact?: boolean;
  banner?: boolean;
  panel?: boolean;
}) {
  const { kind, grade } = parsePromotionLabel(promotion.label);

  if (panel) {
    return (
      <div
        className={cn(
          "distributor-compensation-breakdown-card__promotion",
          compact && "distributor-compensation-breakdown-card__promotion--compact",
          "distributor-compensation-breakdown-card__promotion--panel",
        )}
      >
        <div className="distributor-compensation-breakdown-card__promotion-panel-main">
          <span className="distributor-compensation-breakdown-card__promotion-icon" aria-hidden>
            <TrendingUp className="size-3.5" strokeWidth={2.25} />
          </span>
          <div className="distributor-compensation-breakdown-card__promotion-panel-copy">
            <p className="distributor-compensation-breakdown-card__promotion-panel-eyebrow">{kind}</p>
            <p className="distributor-compensation-breakdown-card__promotion-panel-title">{grade}</p>
          </div>
        </div>
        <span className="distributor-compensation-breakdown-card__promotion-panel-effective">
          {formatPromotionEffectiveDate(promotion.effectiveLabel)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "distributor-compensation-breakdown-card__promotion",
        compact && "distributor-compensation-breakdown-card__promotion--compact",
        banner && "distributor-compensation-breakdown-card__promotion--banner",
        panel && "distributor-compensation-breakdown-card__promotion--panel",
      )}
    >
      <span className="distributor-compensation-breakdown-card__promotion-icon" aria-hidden>
        <TrendingUp className="size-3.5" strokeWidth={2.25} />
      </span>
      <div className="distributor-compensation-breakdown-card__promotion-body">
        <div className="distributor-compensation-breakdown-card__promotion-head">
          <p className="distributor-compensation-breakdown-card__promotion-title">{promotion.label}</p>
          <div className="distributor-compensation-breakdown-card__promotion-chips">
            <span className="distributor-compensation-breakdown-card__promotion-chip distributor-compensation-breakdown-card__promotion-chip--accent tabular-nums">
              +{promotion.hikePct}%
            </span>
            <span className="distributor-compensation-breakdown-card__promotion-chip">{promotion.effectiveLabel}</span>
          </div>
        </div>
        <p className="distributor-compensation-breakdown-card__promotion-salary">
          <span className="tabular-nums" title={formatAum(promotion.previousBaseSalary)}>
            {formatAmount(promotion.previousBaseSalary)}
          </span>
          <ArrowRight className="distributor-compensation-breakdown-card__promotion-arrow" strokeWidth={2.25} aria-hidden />
          <span
            className="distributor-compensation-breakdown-card__promotion-salary-new tabular-nums"
            title={formatAum(promotion.newBaseSalary)}
          >
            {formatAmount(promotion.newBaseSalary)}
          </span>
          {!banner && !panel ? (
            <span className="distributor-compensation-breakdown-card__promotion-salary-note">base salary</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

type DistributorPayrollBreakdownCardProps = {
  className?: string;
  showHistoryLink?: boolean;
  variant?: "default" | "dashboard";
  compensation?: DistributorJobCompensation;
  performance?: DistributorJobPerformanceCalc;
  promotion?: DistributorPayrollPromotion | null;
};

function paymentStatusVariant(
  status: typeof DUMMY_DISTRIBUTOR_JOB_COMPENSATION.paymentStatus,
): StatusBadgeVariant {
  if (status === "done") return "success";
  if (status === "waiting") return "warning";
  if (status === "partial") return "info";
  return "destructive";
}

function formatAmount(amount: number): string {
  return formatPortfolioMetricAmount(amount);
}

export function DistributorPayrollBreakdownCard({
  className,
  showHistoryLink = true,
  variant = "default",
  compensation,
  performance,
  promotion,
}: DistributorPayrollBreakdownCardProps) {
  const comp = compensation ?? DUMMY_DISTRIBUTOR_JOB_COMPENSATION;
  const perf = performance ?? DUMMY_DISTRIBUTOR_JOB_PERFORMANCE;
  const promotionData = promotion ?? DUMMY_DISTRIBUTOR_PAYROLL_PROMOTION;
  const showPromotion = promotionData ? hasPayrollPromotion(promotionData) : false;
  const showWaitingBadge = shouldShowPayrollWaitingBadge(comp);
  const isDashboard = variant === "dashboard";
  const cardClassName = cn(
    "distributor-compensation-breakdown-card",
    isDashboard && "distributor-compensation-breakdown-card--dashboard",
    className,
  );

  const cardBody = (
    <>
      <div className="distributor-compensation-breakdown-card__head">
        <div className="distributor-compensation-breakdown-card__head-copy">
          {isDashboard ? (
            <h2 className="distributor-compensation-breakdown-card__title">Sales and Incentives</h2>
          ) : (
            <>
              <p className="distributor-compensation-breakdown-card__eyebrow">
                {comp.periodLabel} · Payroll detail
              </p>
              <h2 className="distributor-compensation-breakdown-card__title">Salary & incentives</h2>
            </>
          )}
        </div>
        <div className="distributor-compensation-breakdown-card__head-actions">
          {showWaitingBadge ? (
            <StatusBadge variant={paymentStatusVariant(comp.paymentStatus)}>
              {getSalaryPaymentStatusLabel(comp.paymentStatus)}
            </StatusBadge>
          ) : null}
          {showHistoryLink && isDashboard ? (
            <span className="distributor-job-sidebar-card__action" aria-hidden>
              <ArrowUpRight className="size-3.5" strokeWidth={2.25} />
            </span>
          ) : null}
        </div>
      </div>

      {isDashboard ? (
        <div
          className={cn(
            "distributor-compensation-breakdown-card__widget-content distributor-compensation-breakdown-card__widget-content--split",
            !showPromotion &&
              "distributor-compensation-breakdown-card__widget-content--incentive-only",
          )}
        >
          {showPromotion ? <PayrollPromotionStrip promotion={promotionData} compact panel /> : null}
          <PerformanceIncentivePanel perf={perf} variant="dashboard" />
        </div>
      ) : (
        <>
          {showPromotion ? <PayrollPromotionStrip promotion={promotionData} /> : null}
          <PerformanceIncentivePanel perf={perf} />
        </>
      )}

      {!isDashboard ? (
        <>
          <p className="distributor-compensation-breakdown-card__footnote">
            <Info className="size-3.5 shrink-0 opacity-70" strokeWidth={2.25} aria-hidden />
            <span>Commission settlements are paid separately from payroll</span>
          </p>
        </>
      ) : null}

      {showHistoryLink && !isDashboard ? (
        <Link
          href={PAYROLL_HISTORY_HREF}
          className="distributor-current-payroll-card__cta distributor-compensation-breakdown-card__history-link"
        >
          <span>View payroll history</span>
          <ArrowUpRight className="size-4" strokeWidth={2.25} aria-hidden />
        </Link>
      ) : null}
    </>
  );

  if (isDashboard) {
    return (
      <Link
        href={PAYROLL_HISTORY_HREF}
        aria-label="Sales and incentives payroll detail"
        className={cardClassName}
      >
        {cardBody}
      </Link>
    );
  }

  return <article className={cardClassName}>{cardBody}</article>;
}
