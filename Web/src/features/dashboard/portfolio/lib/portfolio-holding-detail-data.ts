import type { MfOrder } from "@/features/invest/api/invest-api";
import { getUpcomingHoldingOrders } from "@/features/invest/lib/mf-transaction-filters";
import { isFundUuid, slugifyFundName } from "@/features/invest/lib/mf-fund-url";

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
  amcLogoUrl: string | null;
  isin?: string | null;
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
  redeemBankName: string | null;
  redeemBankIfsc: string | null;
  nomineeName: string | null;
  transactions: PortfolioHoldingTransaction[];
};

export function portfolioHoldingDetailHref(holdingId: string) {
  return `/dashboard/portfolio/${encodeURIComponent(holdingId)}`;
}

export const PORTFOLIO_UPCOMING_HOLDING_ROUTE_PREFIX = "upcoming:";

type PortfolioUpcomingRouteSource = Pick<
  MfOrder,
  "order_id" | "amc_slug" | "amc_name" | "product_slug" | "product_name"
>;

export function portfolioUpcomingHoldingSlug(order: PortfolioUpcomingRouteSource) {
  if (order.product_slug) return order.product_slug;
  if (order.product_name) return slugifyFundName(order.product_name);
  if (order.amc_slug) return order.amc_slug;
  if (order.amc_name) return slugifyFundName(order.amc_name);
  return order.order_id;
}

export function portfolioUpcomingHoldingDetailHref(order: PortfolioUpcomingRouteSource) {
  return portfolioHoldingDetailHref(
    `${PORTFOLIO_UPCOMING_HOLDING_ROUTE_PREFIX}${portfolioUpcomingHoldingSlug(order)}`,
  );
}

export function parsePortfolioHoldingRouteParam(holdingId: string) {
  const decoded = decodePortfolioHoldingId(holdingId);
  if (decoded.startsWith(PORTFOLIO_UPCOMING_HOLDING_ROUTE_PREFIX)) {
    return {
      kind: "upcoming" as const,
      slug: decoded.slice(PORTFOLIO_UPCOMING_HOLDING_ROUTE_PREFIX.length),
    };
  }
  return { kind: "holding" as const, holdingId: decoded };
}

export function resolveUpcomingHoldingOrder(orders: MfOrder[], slug: string) {
  const upcomingOrders = getUpcomingHoldingOrders(orders);
  if (upcomingOrders.length === 0) return undefined;

  if (isFundUuid(slug)) {
    return upcomingOrders.find((order) => order.order_id === slug);
  }

  const byAmcSlug = upcomingOrders.filter((order) => portfolioUpcomingHoldingSlug(order) === slug);
  if (byAmcSlug.length === 1) return byAmcSlug[0];

  const byProductSlug = upcomingOrders.filter(
    (order) => order.product_slug === slug || slugifyFundName(order.product_name ?? "") === slug,
  );
  if (byProductSlug.length === 1) return byProductSlug[0];

  const candidates = byAmcSlug.length > 0 ? byAmcSlug : byProductSlug;
  if (candidates.length === 0) return undefined;

  return [...candidates].sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
    return rightTime - leftTime;
  })[0];
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
