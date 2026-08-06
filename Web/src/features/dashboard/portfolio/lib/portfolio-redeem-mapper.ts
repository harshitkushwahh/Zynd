import type {
  MfRedemptionJourney,
  PortfolioRedeemUnitsItem,
} from "@/features/dashboard/portfolio/lib/portfolio-api";
import type { PortfolioRedeemJourney } from "@/features/dashboard/portfolio/lib/portfolio-redeem-journey-copy";

export function mapRedemptionJourneyToPortfolioView(journey: MfRedemptionJourney): PortfolioRedeemJourney {
  return {
    orderId: journey.order_id,
    status: journey.status,
    amountInr: journey.amount_inr,
    units: journey.units,
    placedAt: journey.placed_at,
    events: journey.events.map((event) => ({
      from_status: event.from_status,
      to_status: event.to_status,
      source: event.source,
      payload: event.payload,
      created_at: event.created_at,
    })),
  };
}

export type PortfolioRedeemUnitsRow = {
  id: string;
  fundName: string;
  amcName: string;
  redeemableUnits: number;
  currentNav: number;
  redeemableValueInr: number;
  redeemBankLabel: string | null;
  activeRedemptionId: string | null;
};

export function mapRedeemUnitsItemToRow(item: PortfolioRedeemUnitsItem): PortfolioRedeemUnitsRow {
  return {
    id: item.id,
    fundName: item.fund_name,
    amcName: item.amc_name ?? "Mutual fund",
    redeemableUnits: item.redeemable_units,
    currentNav: item.nav ?? 0,
    redeemableValueInr:
      item.redeemable_amount_inr ??
      Math.round(item.redeemable_units * (item.nav ?? 0) * 100) / 100,
    redeemBankLabel: null,
    activeRedemptionId: item.active_redemption?.fp_redemption_id ?? null,
  };
}
