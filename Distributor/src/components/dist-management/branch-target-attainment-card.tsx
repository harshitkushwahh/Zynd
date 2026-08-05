"use client";

import { useMemo, useState } from "react";

import { BranchPerfInsightChartCard } from "@/components/dist-management/branch-perf-insight-chart-card";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import {
  BRANCH_PERFORMANCE_MONTHS,
  BRANCH_TARGET_ATTAINMENT_YEAR_OPTIONS,
  getBranchTargetHeatmapForYear,
  heatmapAttainmentLevel,
  type BranchTargetAttainmentYear,
} from "@/lib/dummy/branch-team-performance";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export function BranchTargetAttainmentCard() {
  const [year, setYear] = useState<BranchTargetAttainmentYear>("2026");

  const heatmapRows = useMemo(() => {
    const byDist = new Map<string, { name: string; cells: Map<string, number> }>();
    for (const cell of getBranchTargetHeatmapForYear(year)) {
      let row = byDist.get(cell.distributorId);
      if (!row) {
        row = { name: cell.distributorName, cells: new Map() };
        byDist.set(cell.distributorId, row);
      }
      row.cells.set(cell.month, cell.attainmentPct);
    }
    return [...byDist.values()];
  }, [year]);

  return (
    <BranchPerfInsightChartCard
      eyebrow={ZYND_MITRA_COPY.byMitra}
      title="Monthly target attainment"
      plotClassName="distributor-reports-insight-chart__plot--heatmap branch-perf-heatmap-wrap branch-perf-heatmap-wrap--scroll"
      headerTrailing={
        <StatusFilterSelect
          label="Year"
          value={year}
          options={[...BRANCH_TARGET_ATTAINMENT_YEAR_OPTIONS]}
          onValueChange={(value) => {
            if (value !== "all") setYear(value);
          }}
        />
      }
      footer={
        <div className="branch-perf-heatmap-legend">
          <span className="branch-perf-heatmap-legend__label">Attainment</span>
          <div className="branch-perf-heatmap-legend__scale">
            <span className="branch-perf-heatmap__cell branch-perf-heatmap__cell--low">&lt;75%</span>
            <span className="branch-perf-heatmap__cell branch-perf-heatmap__cell--mid">75–94%</span>
            <span className="branch-perf-heatmap__cell branch-perf-heatmap__cell--high">95–109%</span>
            <span className="branch-perf-heatmap__cell branch-perf-heatmap__cell--over">110%+</span>
          </div>
        </div>
      }
    >
      <div className="branch-perf-heatmap-split">
        <div className="branch-perf-heatmap-split__labels">
          <div className="branch-perf-heatmap-split__label branch-perf-heatmap-split__label--head">
            Distributor
          </div>
          {heatmapRows.map((row) => (
            <div key={row.name} className="branch-perf-heatmap-split__label">
              {row.name.split(" ")[0]}
            </div>
          ))}
        </div>
        <div
          className="branch-perf-heatmap-scroll"
          tabIndex={0}
          role="region"
          aria-label={`Monthly target attainment for ${year}. Scroll horizontally for all months.`}
        >
          <div className="branch-perf-heatmap" role="table">
            <div className="branch-perf-heatmap__row branch-perf-heatmap__row--head" role="row">
              {BRANCH_PERFORMANCE_MONTHS.map((month) => (
                <span key={month} className="branch-perf-heatmap__month" role="columnheader">
                  {month}
                </span>
              ))}
            </div>
            {heatmapRows.map((row) => (
              <div key={row.name} className="branch-perf-heatmap__row" role="row">
                {BRANCH_PERFORMANCE_MONTHS.map((month) => {
                  const pct = row.cells.get(month) ?? 0;
                  const level = heatmapAttainmentLevel(pct);
                  return (
                    <span
                      key={`${row.name}-${month}`}
                      role="cell"
                      className={cn("branch-perf-heatmap__cell", `branch-perf-heatmap__cell--${level}`)}
                      title={`${row.name} · ${month} ${year}: ${pct}% of target`}
                    >
                      {pct}%
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </BranchPerfInsightChartCard>
  );
}
