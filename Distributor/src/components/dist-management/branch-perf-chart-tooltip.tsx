import type { ReactNode } from "react";

export type BranchPerfChartTooltipRow = {
  label: string;
  value: ReactNode;
};

type BranchPerfChartTooltipProps = {
  label?: string;
  rows: BranchPerfChartTooltipRow[];
};

/** Compact plot tooltip — matches reports insight chart default sizing. */
export function BranchPerfChartTooltip({ label, rows }: BranchPerfChartTooltipProps) {
  if (rows.length === 0) return null;

  return (
    <div className="distributor-reports-insight-chart__plot-tooltip">
      {label ? (
        <p className="distributor-reports-insight-chart__plot-tooltip-label">{label}</p>
      ) : null}
      <ul className="distributor-reports-insight-chart__plot-tooltip-list">
        {rows.map((row) => (
          <li key={row.label} className="distributor-reports-insight-chart__plot-tooltip-row">
            <span>{row.label}</span>
            <span className="tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
