import type {
  AdminFamilyGroupContributionChartPoint,
  AdminFamilyGroupPortfolioSlice,
} from "@/lib/family-groups-admin-api";

const CHART_COLORS = ["#3d6b5e", "#5a9fd4", "#7ec8a8", "#d4a574", "#94a3b8", "#c084fc"];

function donutColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export type AdminFamilyGroupDonutChartSegment = {
  id: string;
  label: string;
  value: number;
  fill?: string;
};

export function mapContributionChartToDonutSegments(
  contributionChart: AdminFamilyGroupContributionChartPoint[],
): AdminFamilyGroupDonutChartSegment[] {
  return contributionChart.map((point, index) => ({
    id: point.user_id,
    label: point.label,
    value: point.amount_inr,
    fill: donutColor(index),
  }));
}

export function mapPortfolioSlicesToDonutSegments(
  slices: AdminFamilyGroupPortfolioSlice[],
): AdminFamilyGroupDonutChartSegment[] {
  return slices.map((slice, index) => ({
    id: slice.id,
    label: slice.label,
    value: slice.amount_inr,
    fill: donutColor(index + 2),
  }));
}

export function sumDonutSegmentValues(segments: AdminFamilyGroupDonutChartSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.value, 0);
}
