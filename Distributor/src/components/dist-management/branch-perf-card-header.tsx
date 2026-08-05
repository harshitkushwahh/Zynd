"use client";

import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";

type BranchPerfCardHeaderProps = {
  eyebrow: string;
  title: string;
};

export function BranchPerfCardHeader({ eyebrow, title }: BranchPerfCardHeaderProps) {
  return (
    <div className="branch-perf-card__header">
      <DistributorInsightCardHeader eyebrow={eyebrow} title={title} titleAs="h3" />
    </div>
  );
}
