export type OverviewAllocationSlice = {
  id: string;
  label: string;
  valuePct: number;
  color: string;
};

export type OverviewGrowthPoint = {
  label: string;
  value: number;
};

export type OverviewPortfolioPreview = {
  currentValueInr: number;
  investedInr: number;
  totalReturnInr: number;
  totalReturnPct: number;
  dayChangeInr: number;
  dayChangePct: number;
  xirrPct: number;
  holdingsCount: number;
  activeSipsCount: number;
  monthlySipInr: number;
  growth: OverviewGrowthPoint[];
  allocation: OverviewAllocationSlice[];
};

export type OverviewHoldingPreview = {
  id: string;
  name: string;
  amc: string;
  valueInr: number;
  investedInr: number;
  returnPct: number;
  allocationPct: number;
};
