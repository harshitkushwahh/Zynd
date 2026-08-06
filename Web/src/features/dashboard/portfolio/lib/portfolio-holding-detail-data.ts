export type PortfolioHoldingTransactionType = "invested" | "redeemed" | "dividend";

export type PortfolioHoldingTransaction = {
  id: string;
  date: string;
  type: PortfolioHoldingTransactionType;
  units: number;
  nav: number;
  valueInr: number;
};

export type PortfolioHoldingDetail = {
  id: string;
  fundName: string;
  amcName: string;
  currentValueInr: number;
  investedInr: number;
  returnPct: number;
  allocationPct: number;
  folioNumber: string;
  holdingMode: "Demat" | "Physical";
  investedMonths: number | null;
  currentNav: number;
  avgNav: number | null;
  returnInr: number;
  dayChangePct: number | null;
  dayChangeInr: number | null;
  xirrPct: number | null;
  redeemableUnits: number;
  redeemBankLabel: string | null;
  nomineeName: string | null;
  transactions: PortfolioHoldingTransaction[];
};

export function portfolioHoldingDetailHref(holdingId: string) {
  return `/dashboard/portfolio/${encodeURIComponent(holdingId)}`;
}

export function portfolioHoldingDetailRedeemHref(holdingId: string) {
  return `${portfolioHoldingDetailHref(holdingId)}?mode=redeem`;
}

export function decodePortfolioHoldingId(encodedHoldingId: string) {
  try {
    return decodeURIComponent(encodedHoldingId);
  } catch {
    return encodedHoldingId;
  }
}
