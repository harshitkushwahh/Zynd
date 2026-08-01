"use client";

import type { ReactNode } from "react";

import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import { cn } from "@/lib/utils";

type BranchPerfInsightChartCardProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  headerTrailing?: ReactNode;
  plotClassName?: string;
  className?: string;
};

/** Dist-management graph card — matches reports insight tab chart chrome. */
export function BranchPerfInsightChartCard({
  eyebrow,
  title,
  children,
  footer,
  headerTrailing,
  plotClassName,
  className,
}: BranchPerfInsightChartCardProps) {
  return (
    <article className={cn("distributor-reports-insight-chart branch-perf-insight-chart-card", className)}>
      <div className="distributor-reports-insight-chart__head branch-perf-insight-chart-card__head">
        <DistributorInsightCardHeader eyebrow={eyebrow} title={title} titleAs="h3" />
        {headerTrailing ? (
          <div className="branch-perf-insight-chart-card__head-trailing">{headerTrailing}</div>
        ) : null}
      </div>
      <div className={cn("distributor-reports-insight-chart__plot", plotClassName)}>{children}</div>
      {footer ? <div className="branch-perf-insight-chart-card__footer">{footer}</div> : null}
    </article>
  );
}
