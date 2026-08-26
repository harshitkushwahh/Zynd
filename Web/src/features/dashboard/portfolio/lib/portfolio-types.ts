export type PortfolioHoldingItem = {
  id: string;
  fundName: string;
  amcName: string;
  amcLogoUrl: string | null;
  isin?: string | null;
  currentValueInr: number;
  investedInr: number;
  returnPct: number;
  allocationPct: number;
};

export function portfolioHoldingAmcInitials(amcName: string) {
  const parts = amcName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}
