import type { MfOrderEvent } from "@/features/invest/api/invest-api";
import { formatEventSource } from "@/features/invest/lib/mf-order-journey-copy";
import { copy } from "@/shared/config/copy";

export type PortfolioRedeemJourney = {
  orderId: string;
  status: string;
  amountInr: number;
  units: number;
  placedAt: string;
  events: MfOrderEvent[];
};

export type RedemptionJourneyDisplayStep = {
  event: MfOrderEvent;
  title: string;
  description: string | null;
  actor: string;
  toStatus: string;
  isTerminal: boolean;
};

export type RedemptionJourneyView = {
  steps: RedemptionJourneyDisplayStep[];
  outcomeSummary: string | null;
};

function titleCaseStatus(status?: string | null) {
  if (!status) return "Unknown";
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function payloadString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isTerminalStatus(status?: string | null) {
  const normalized = status?.toLowerCase();
  return normalized === "cancelled" || normalized === "failed";
}

function describeRedemptionPayload(
  payload: Record<string, unknown> | null | undefined,
  journeyCopy: typeof copy.dashboard.portfolio,
) {
  if (!payload) return null;

  const stage = payloadString(payload.stage);
  const nav = typeof payload.nav === "number" ? payload.nav : null;

  if (stage === "amc_submitted") {
    return journeyCopy.redeemJourneyAmcSubmittedDescription;
  }
  if (stage === "units_redeemed") {
    return nav != null
      ? journeyCopy.redeemJourneyUnitsRedeemedDescription.replace("{nav}", nav.toFixed(2))
      : journeyCopy.redeemJourneyUnitsRedeemedDescriptionGeneric;
  }
  if (stage === "payout_initiated") {
    return journeyCopy.redeemJourneyPayoutInitiatedDescription;
  }
  if (stage === "payout_credited") {
    return journeyCopy.redeemJourneyPayoutCreditedDescription;
  }

  const reason = payloadString(payload.reason);
  if (reason === "redemption_placed") {
    return journeyCopy.redeemJourneyPlacedDescription;
  }

  return null;
}

function describeRedemptionTransition(
  fromStatus: string | null | undefined,
  toStatus: string,
  payload: Record<string, unknown> | null | undefined,
  journeyCopy: typeof copy.dashboard.portfolio,
) {
  const stage = payloadString(payload?.stage);
  const from = fromStatus?.toLowerCase();
  const to = toStatus.toLowerCase();

  if (stage === "amc_submitted") return journeyCopy.redeemJourneyStepAmcSubmitted;
  if (stage === "units_redeemed") return journeyCopy.redeemJourneyStepUnitsRedeemed;
  if (stage === "payout_initiated") return journeyCopy.redeemJourneyStepPayoutInitiated;
  if (stage === "payout_credited") return journeyCopy.redeemJourneyStepPayoutCredited;

  if (!from) {
    if (to === "pending") return journeyCopy.redeemJourneyStepPlaced;
    if (to === "processing") return journeyCopy.redeemJourneyStepProcessing;
    if (to === "submitted") return journeyCopy.redeemJourneyStepAmcSubmitted;
    if (to === "succeeded") return journeyCopy.redeemJourneyStepPayoutCredited;
    if (to === "failed") return journeyCopy.redeemJourneyStepFailed;
    if (to === "cancelled") return journeyCopy.redeemJourneyStepCancelled;
    return titleCaseStatus(to);
  }

  if (from === "pending" && to === "processing") return journeyCopy.redeemJourneyStepProcessing;
  if (from === "processing" && to === "submitted") return journeyCopy.redeemJourneyStepAmcSubmitted;
  if (from === "submitted" && to === "succeeded") return journeyCopy.redeemJourneyStepPayoutCredited;
  if (to === "failed") return journeyCopy.redeemJourneyStepFailed;
  if (to === "cancelled") return journeyCopy.redeemJourneyStepCancelled;

  return `${titleCaseStatus(from)} to ${titleCaseStatus(to)}`;
}

function toDisplayStep(event: MfOrderEvent): RedemptionJourneyDisplayStep {
  const portfolioCopy = copy.dashboard.portfolio;

  return {
    event,
    title: describeRedemptionTransition(event.from_status, event.to_status, event.payload, portfolioCopy),
    description: describeRedemptionPayload(event.payload, portfolioCopy),
    actor: formatEventSource(event.source),
    toStatus: titleCaseStatus(event.to_status),
    isTerminal: isTerminalStatus(event.to_status),
  };
}

export function buildRedemptionJourneyView(journey: PortfolioRedeemJourney): RedemptionJourneyView {
  const portfolioCopy = copy.dashboard.portfolio;
  const steps = journey.events.map(toDisplayStep);

  let outcomeSummary: string | null = null;
  const status = journey.status.toLowerCase();

  if (status === "succeeded") {
    outcomeSummary = portfolioCopy.redeemJourneyOutcomeSucceeded;
  } else if (status === "failed") {
    outcomeSummary = portfolioCopy.redeemJourneyOutcomeFailed;
  } else if (status === "cancelled") {
    outcomeSummary = portfolioCopy.redeemJourneyOutcomeCancelled;
  } else if (status === "submitted") {
    outcomeSummary = portfolioCopy.redeemJourneyOutcomeSubmitted;
  } else if (status === "processing") {
    outcomeSummary = portfolioCopy.redeemJourneyOutcomeProcessing;
  }

  return { steps, outcomeSummary };
}
