/** Shared chart types for the Support dashboard (values come from live ticket analytics). */

export type SupportOverviewTrendPoint = {
  day: string;
  open: number;
  inProgress: number;
  resolved: number;
};

export type SupportOverviewCategorySegment = {
  id: string;
  label: string;
  count: number;
  fill: string;
};
