import type { OverviewAllocationSlice } from "@/features/dashboard/overview/lib/overview-portfolio-preview";

const ALLOCATION_CHART_FILLS: Record<string, string> = {
  equity: "#0ea5e9",
  debt: "#10b981",
  hybrid: "#f59e0b",
  gold: "#fb7185",
};

export function portfolioAllocationChartFill(slice: OverviewAllocationSlice) {
  return ALLOCATION_CHART_FILLS[slice.id] ?? "#94a3b8";
}
