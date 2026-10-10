import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type DistributorGrowthBadgeProps = {
  /** Numeric change (sign determines up/down when direction is omitted). */
  value: number;
  /** Prefix "+" for positive values. */
  showSign?: boolean;
  /** Leading trend arrow inside the pill. */
  showIcon?: boolean;
  decimals?: number;
  /** Optional muted label after the pill (e.g. " vs last week"). */
  suffix?: string;
  className?: string;
  direction?: "up" | "down";
};

function formatGrowthValue(value: number, showSign: boolean, decimals: number): string {
  const formatted = Math.abs(value).toFixed(decimals);
  if (value > 0 && showSign) return `+${formatted}%`;
  if (value < 0) return `-${formatted}%`;
  return `${formatted}%`;
}

/** Green/red pill for MTD growth, AUM delta, work-time trend, portfolio returns %, etc. */
export function DistributorGrowthBadge({
  value,
  showSign = true,
  showIcon = true,
  decimals = 1,
  suffix,
  className,
  direction,
}: DistributorGrowthBadgeProps) {
  const isUp = direction ? direction === "up" : value >= 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={cn("distributor-growth-badge-wrap", className)}>
      <span
        className={cn(
          "distributor-growth-badge tabular-nums",
          isUp ? "distributor-growth-badge--up" : "distributor-growth-badge--down",
        )}
      >
        {showIcon ? (
          <Icon className="distributor-growth-badge__icon size-3.5" strokeWidth={2.5} aria-hidden />
        ) : null}
        {formatGrowthValue(value, showSign, decimals)}
      </span>
      {suffix ? (
        <span className="distributor-growth-badge-wrap__suffix">{suffix}</span>
      ) : null}
    </span>
  );
}
