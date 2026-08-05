export type AdminFamilyGroupProgressPeriod = "1M" | "3M" | "6M" | "1Y";

export const ADMIN_FAMILY_GROUP_PROGRESS_PERIODS: AdminFamilyGroupProgressPeriod[] = [
  "1M",
  "3M",
  "6M",
  "1Y",
];

export type AdminFamilyGroupProgressChartPoint = {
  label: string;
  goalProgressInr: number;
  investedInr: number;
};

export function mapRealProgressChartToSeries(
  progressChart: Array<{
    period_key: string;
    label: string;
    goal_progress_inr: number;
    invested_inr: number;
  }>,
  period: AdminFamilyGroupProgressPeriod,
): AdminFamilyGroupProgressChartPoint[] {
  if (progressChart.length === 0) return [];

  const now = new Date();
  const cutoffs: Record<AdminFamilyGroupProgressPeriod, number> = {
    "1M": 30,
    "3M": 92,
    "6M": 183,
    "1Y": 366,
  };
  const cutoff = new Date(now.getTime() - cutoffs[period] * 24 * 60 * 60 * 1000);

  return progressChart
    .filter((point) => {
      const [year, month] = point.period_key.split("-").map(Number);
      if (!year || !month) return true;
      const pointDate = new Date(year, month - 1, 1);
      return pointDate >= cutoff;
    })
    .map((point) => ({
      label: point.label,
      goalProgressInr: point.goal_progress_inr,
      investedInr: point.invested_inr,
    }));
}
