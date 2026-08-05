/** Overview investments card holding item. */

export type OverviewHoldingCardItem = {
  id: string;
  fundName: string;
  amcName: string;
  amcLogoUrl: string | null;
  investedInr: number;
  monthReturnPct: number | null;
};

export function truncateHoldingFundName(name: string, maxLength = 24) {
  if (name.length <= maxLength) return name;
  return `${name.slice(0, maxLength).trimEnd()}…`;
}
