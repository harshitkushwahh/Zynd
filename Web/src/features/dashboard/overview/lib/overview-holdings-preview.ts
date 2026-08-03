/** Preview-only top holdings for the overview investments card. */

export type OverviewHoldingCardItem = {
  id: string;
  fundName: string;
  amcName: string;
  amcLogoUrl: string | null;
  investedInr: number;
  monthReturnPct: number;
};

export const OVERVIEW_HOLDINGS_CARD_PREVIEW: OverviewHoldingCardItem[] = [
  {
    id: "hdfc-midcap",
    fundName: "HDFC Mid-Cap Opportunities Fund",
    amcName: "HDFC Mutual Fund",
    amcLogoUrl: null,
    investedInr: 74_500,
    monthReturnPct: 4.21,
  },
  {
    id: "sbi-small-cap",
    fundName: "SBI Small Cap Fund",
    amcName: "SBI Mutual Fund",
    amcLogoUrl: null,
    investedInr: 38_000,
    monthReturnPct: -1.02,
  },
  {
    id: "icici-bluechip",
    fundName: "ICICI Pru Bluechip Fund",
    amcName: "ICICI Prudential Mutual Fund",
    amcLogoUrl: null,
    investedInr: 58_900,
    monthReturnPct: 2.35,
  },
  {
    id: "axis-flexi",
    fundName: "Axis Flexi Cap Fund",
    amcName: "Axis Mutual Fund",
    amcLogoUrl: null,
    investedInr: 52_400,
    monthReturnPct: 1.18,
  },
  {
    id: "kotak-emerging",
    fundName: "Kotak Emerging Equity Fund",
    amcName: "Kotak Mutual Fund",
    amcLogoUrl: null,
    investedInr: 41_200,
    monthReturnPct: -0.64,
  },
  {
    id: "nippon-large",
    fundName: "Nippon India Large Cap Fund",
    amcName: "Nippon India Mutual Fund",
    amcLogoUrl: null,
    investedInr: 36_800,
    monthReturnPct: 3.02,
  },
];

export function truncateHoldingFundName(name: string, maxLength = 24) {
  if (name.length <= maxLength) return name;
  return `${name.slice(0, maxLength).trimEnd()}…`;
}
