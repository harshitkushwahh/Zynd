import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

type AdminGrowthBadgeProps = {
  value: number;
  showSign?: boolean;
  showIcon?: boolean;
  decimals?: number;
  className?: string;
  direction?: "up" | "down";
};

function formatGrowthValue(value: number, showSign: boolean, decimals: number) {
  const formatted = Math.abs(value).toFixed(decimals);
  if (value > 0 && showSign) return `+${formatted}%`;
  if (value < 0) return `-${formatted}%`;
  return `${formatted}%`;
}

export function AdminGrowthBadge({
  value,
  showSign = true,
  showIcon = true,
  decimals = 1,
  className,
  direction,
}: AdminGrowthBadgeProps) {
  const isUp = direction ? direction === "up" : value >= 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "admin-growth-badge tabular-nums",
        isUp ? "admin-growth-badge--up" : "admin-growth-badge--down",
        className,
      )}
    >
      {showIcon ? <Icon className="admin-growth-badge__icon size-3.5" strokeWidth={2.5} aria-hidden /> : null}
      {formatGrowthValue(value, showSign, decimals)}
    </span>
  );
}
