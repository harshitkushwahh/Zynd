import type { DistributorClientHolding } from "@/lib/dummy/types";

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export type DistributorClientPortfolioDemoSnapshot = {
  current: number;
  invested: number;
  returns: number;
  redeemable: number;
  chartAnchor: number;
};

export function getDistributorClientPortfolioDemo(
  clientKey: string,
): DistributorClientPortfolioDemoSnapshot {
  const seed = hashSeed(clientKey);
  const current = 285_000 + (seed % 140) * 1_000;
  const invested = Math.round(current * (0.78 + (seed % 12) * 0.01));
  const returns = current - invested;
  const redeemable = Math.round(current * (0.88 + (seed % 8) * 0.01));
  return { current, invested, returns, redeemable, chartAnchor: current };
}

export function buildDistributorClientPortfolioDemoHoldings(
  investorId: string,
  clientCode: string,
  snapshot: DistributorClientPortfolioDemoSnapshot,
): DistributorClientHolding[] {
  const seed = hashSeed(investorId);
  const asOf = new Date().toISOString().slice(0, 10);
  const primary = snapshot.current * 0.68;
  const secondary = snapshot.current - primary;
  const primaryUnits = 900 + (seed % 120);
  const primaryNav = primary / primaryUnits;

  return [
    {
      id: `${investorId}-demo-h1`,
      schemeName: "Zynd Flexi Cap Direct Growth",
      amcName: "Zynd Asset Management",
      folioNumber: `ZY${clientCode.slice(-6)}01`,
      isin: "INF000000101",
      currentValue: primary,
      investedAmount: primary * 0.9,
      redeemableValue: primary,
      units: primaryUnits,
      navPerUnit: primaryNav,
      asOfDate: asOf,
    },
    {
      id: `${investorId}-demo-h2`,
      schemeName: "Zynd Liquid Direct Growth",
      amcName: "Zynd Asset Management",
      folioNumber: `ZY${clientCode.slice(-6)}02`,
      isin: "INF000000202",
      currentValue: secondary,
      investedAmount: secondary * 0.97,
      redeemableValue: secondary,
      units: 120 + (seed % 40),
      navPerUnit: secondary / (120 + (seed % 40)),
      asOfDate: asOf,
    },
  ];
}

export function resolvePortfolioChartAnchorValue(
  clientId: string,
  currentValue: number,
): number {
  if (currentValue > 0) return currentValue;
  return getDistributorClientPortfolioDemo(clientId).chartAnchor;
}
