/** Preview-only portfolio snapshot used until live portfolio sync is available. */

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

export const OVERVIEW_PORTFOLIO_PREVIEW: OverviewPortfolioPreview = {
  currentValueInr: 4_28_650,
  investedInr: 3_81_400,
  totalReturnInr: 47_250,
  totalReturnPct: 12.4,
  dayChangeInr: 3_420,
  dayChangePct: 0.8,
  xirrPct: 14.2,
  holdingsCount: 5,
  activeSipsCount: 0,
  monthlySipInr: 0,
  growth: [
    { label: "Jan", value: 2_85_000 },
    { label: "Feb", value: 2_98_400 },
    { label: "Mar", value: 3_12_100 },
    { label: "Apr", value: 3_28_600 },
    { label: "May", value: 3_45_200 },
    { label: "Jun", value: 3_72_800 },
    { label: "Jul", value: 4_28_650 },
  ],
  allocation: [
    { id: "equity", label: "Equity", valuePct: 68, color: "var(--zynd-emerald)" },
    { id: "debt", label: "Debt", valuePct: 22, color: "#38bdf8" },
    { id: "hybrid", label: "Hybrid", valuePct: 7, color: "#f59e0b" },
    { id: "other", label: "Other", valuePct: 3, color: "#94a3b8" },
  ],
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

export const OVERVIEW_HOLDINGS_PREVIEW: OverviewHoldingPreview[] = [
  {
    id: "1",
    name: "Parag Parikh Flexi Cap Fund",
    amc: "PPFAS Mutual Fund",
    valueInr: 1_42_800,
    investedInr: 1_18_000,
    returnPct: 21.0,
    allocationPct: 33,
  },
  {
    id: "2",
    name: "UTI Nifty 50 Index Fund",
    amc: "UTI Mutual Fund",
    valueInr: 98_450,
    investedInr: 92_000,
    returnPct: 7.0,
    allocationPct: 23,
  },
  {
    id: "3",
    name: "HDFC Mid-Cap Opportunities",
    amc: "HDFC Mutual Fund",
    valueInr: 86_200,
    investedInr: 74_500,
    returnPct: 15.7,
    allocationPct: 20,
  },
  {
    id: "4",
    name: "ICICI Pru Corporate Bond",
    amc: "ICICI Prudential",
    valueInr: 61_200,
    investedInr: 58_900,
    returnPct: 3.9,
    allocationPct: 14,
  },
  {
    id: "5",
    name: "SBI Small Cap Fund",
    amc: "SBI Mutual Fund",
    valueInr: 40_000,
    investedInr: 38_000,
    returnPct: 5.3,
    allocationPct: 10,
  },
];
