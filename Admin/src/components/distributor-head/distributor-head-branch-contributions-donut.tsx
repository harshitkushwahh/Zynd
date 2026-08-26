"use client";

import { useMemo } from "react";

import {
  AdminFamilyGroupDonutChart,
  adminFamilyGroupDonutLegendColor,
  type AdminFamilyGroupDonutSegment,
} from "@/components/users/admin-family-group-donut-chart";
import type { AdminHierarchyBranch } from "@/lib/admin-distributor-hierarchy-api";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";

type DistributorHeadBranchContributionsDonutProps = {
  branches: AdminHierarchyBranch[];
  totalAum: number;
};

export function DistributorHeadBranchContributionsDonut({
  branches,
  totalAum,
}: DistributorHeadBranchContributionsDonutProps) {
  const segments = useMemo<AdminFamilyGroupDonutSegment[]>(() => {
    const hasBook = branches.some((branch) => branch.aum_inr > 0);
    return branches.map((branch, index) => ({
      id: branch.id,
      label: branch.name,
      value: hasBook ? branch.aum_inr : 1,
      fill: adminFamilyGroupDonutLegendColor(index),
    }));
  }, [branches]);

  const chartTotal = segments.reduce((sum, segment) => sum + segment.value, 0);
  const centerValue = formatDistributorHeadInr(totalAum);

  return (
    <div className="distributor-head-state-totals__contributions">
      <p className="distributor-head-state-totals__contributions-title">Branch contributions</p>
      <AdminFamilyGroupDonutChart
        segments={segments}
        centerValue={centerValue}
        centerCaption="Book AUM"
        emptyLabel="No branches yet"
        emptyDescription="Branch contributions will appear once branches are added."
        className="distributor-head-state-totals__donut"
      />
      {branches.length > 0 && chartTotal > 0 ? (
        <ul className="distributor-head-state-totals__legend" aria-label="Branch contribution breakdown">
          {segments.map((segment, index) => {
            const share = totalAum > 0 ? (segment.value / totalAum) * 100 : 0;
            return (
              <li key={segment.id} className="distributor-head-state-totals__legend-item">
                <span
                  className="distributor-head-state-totals__legend-swatch"
                  style={{ backgroundColor: segment.fill ?? adminFamilyGroupDonutLegendColor(index) }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{segment.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {totalAum > 0 ? `${share.toFixed(1)}%` : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
