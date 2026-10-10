import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { cn } from "@/lib/utils";

export type SupportPageMetricTileProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tileTone?: "default" | "accent" | "success";
  fitTileValue?: boolean;
  valueTitle?: string;
  className?: string;
};

/** Shared metric tile for Support list pages (transactions, KYC, logs). */
export function SupportPageMetricTile({ className, ...props }: SupportPageMetricTileProps) {
  return (
    <DistributorMetricCard
      variant="tile"
      showTileAction={false}
      className={cn("support-page-metric-tile h-full w-full", className)}
      {...props}
    />
  );
}

export function SupportPageMetricTilesGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "support-page-metric-tiles-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
