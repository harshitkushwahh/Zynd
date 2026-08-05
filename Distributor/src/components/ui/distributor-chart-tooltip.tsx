import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DistributorChartTooltipProps = {
  children: ReactNode;
  className?: string;
};

/** Shared Recharts / chart hover surface — uses global surface tokens. */
export function DistributorChartTooltip({ children, className }: DistributorChartTooltipProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-5xl)] border border-border bg-popover px-3 py-2 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
