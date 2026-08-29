import type { OverviewAllocationSlice } from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import { recommendFundsAllocationChartFill } from "@/components/dashboard/recommend-funds-allocation-panel";
import type { FundsForYouAllocationSlice } from "@/features/recommendations/types/funds-for-you";

export function mapFundsForYouAllocation(
  slices: readonly FundsForYouAllocationSlice[],
): OverviewAllocationSlice[] {
  return slices.map((slice) => ({
    id: slice.id,
    label: slice.label,
    valuePct: slice.value_pct,
    color: recommendFundsAllocationChartFill({ id: slice.id, label: slice.label, valuePct: slice.value_pct, color: "" }),
  }));
}
