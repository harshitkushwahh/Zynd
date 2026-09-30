import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { MfOrder, MfOrderEvent } from "@/features/invest/api/invest-api";
import {
  formatCybrillaStatusLabel,
  resolveCybrillaOrderStatusLabel,
} from "@/features/invest/lib/mf-cybrilla-status";
import {
  isOrderAwaitingAllotment,
  isOrderPaymentCompleted,
} from "@/features/invest/lib/mf-order-payment-status";
import { copy } from "@/shared/config/copy";

const SOURCE_LABELS: Record<string, string> = {
  SYSTEM: "Zynd",
  WORKER: "Zynd",
  USER: "You",
  WEBHOOK: "Zynd",
  RECONCILE: "Zynd",
};

export type JourneyDisplayStep = {
  event: MfOrderEvent | null;
  title: string;
  description: string | null;
  actor: string;
  toStatus: string;
  badgeVariant: StatusBadgeVariant;
  isTerminal: boolean;
  isComplete: boolean;
};

export type OrderJourneyView = {
  steps: JourneyDisplayStep[];
};

function payloadString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const LIVE_REDEMPTION_FP_STATES = new Set([
  "pending",
  "created",
  "review_completed",
  "confirmed",
  "processing",
  "review",
  "under_review",
  "submitted",
]);

const TERMINAL_REDEMPTION_FP_FAILURE_STATES = new Set([
  "failed",
  "cancelled",
  "rejected",
  "expired",
]);

function isRedemptionOrder(order: Pick<MfOrder, "order_type">) {
  return order.order_type?.trim().toUpperCase() === "REDEMPTION";
}

function redemptionFpState(order: Pick<MfOrder, "fp_state">) {
  return order.fp_state?.trim().toLowerCase() ?? "";
}

function isLiveRedemptionFpState(order: Pick<MfOrder, "fp_state">) {
  return LIVE_REDEMPTION_FP_STATES.has(redemptionFpState(order));
}

function isTerminalRedemptionFpFailure(order: Pick<MfOrder, "fp_state">) {
  return TERMINAL_REDEMPTION_FP_FAILURE_STATES.has(redemptionFpState(order));
}

function isRedemptionAwaitingConsent(order: Pick<MfOrder, "status" | "fp_state">) {
  if (isTerminalRedemptionFpFailure(order)) return false;
  const normalized = order.status?.trim().toUpperCase() ?? "";
  const fpState = redemptionFpState(order);
  return normalized === "PAYMENT_PENDING" || normalized === "PENDING" || fpState === "pending";
}

function isRedemptionOrderFailed(
  order: Pick<MfOrder, "status" | "fp_state" | "failure_reason">,
) {
  if (isTerminalRedemptionFpFailure(order)) return true;
  const status = order.status?.trim().toUpperCase() ?? "";
  return (status === "FAILED" || status === "CANCELLED") && !isLiveRedemptionFpState(order);
}

function redemptionFailureLabel(order: Pick<MfOrder, "fp_state" | "failure_reason">) {
  const reason = order.failure_reason?.trim();
  if (reason && reason.toLowerCase() !== redemptionFpState(order)) {
    return reason;
  }
  return formatCybrillaStatusLabel(order.fp_state) ?? copy.transactions.journeyStatusFailed;
}

function isPaymentAbandoned(order: MfOrder, events: MfOrderEvent[]) {
  if (isRedemptionOrder(order)) return false;
  const status = order.status?.toUpperCase();
  if (
    status &&
    status !== "CANCELLED" &&
    status !== "FAILED" &&
    order.failure_code !== "payment_abandoned"
  ) {
    return false;
  }

  if (order.failure_code === "payment_abandoned") return true;

  const lastEvent = events[events.length - 1];
  if (
    order.status?.toUpperCase() === "CANCELLED" &&
    lastEvent?.to_status?.toUpperCase() === "CANCELLED" &&
    lastEvent.source?.toUpperCase() === "USER"
  ) {
    return true;
  }

  return events.some((event) => payloadString(event.payload?.reason) === "payment_abandoned");
}

function wasRepairedAfterAbandon(events: MfOrderEvent[]) {
  return events.some(
    (event) =>
      event.source?.toUpperCase() === "RECONCILE" ||
      payloadString(event.payload?.repair) === "abandoned_paid",
  );
}

function hasPaymentCompleted(order: MfOrder, events: MfOrderEvent[]) {
  return isOrderPaymentCompleted(order, events);
}

function findTimestamp(
  order: MfOrder,
  events: MfOrderEvent[],
  matcher: (event: MfOrderEvent) => boolean,
): string | null {
  const matched = events.find(matcher);
  return matched?.created_at ?? order.created_at ?? null;
}

function syntheticEvent(createdAt: string | null): MfOrderEvent {
  return {
    from_status: null,
    to_status: "",
    source: "SYSTEM",
    payload: null,
    created_at: createdAt,
  };
}

function buildStep(args: {
  title: string;
  description: string | null;
  actor?: string;
  toStatus: string;
  badgeVariant: StatusBadgeVariant;
  isTerminal?: boolean;
  isComplete: boolean;
  createdAt: string | null;
}): JourneyDisplayStep {
  return {
    event: syntheticEvent(args.createdAt),
    title: args.title,
    description: args.description,
    actor: args.actor ?? "Zynd",
    toStatus: args.toStatus,
    badgeVariant: args.badgeVariant,
    isTerminal: args.isTerminal ?? false,
    isComplete: args.isComplete,
  };
}

function buildAbandonedJourney(order: MfOrder, events: MfOrderEvent[]): OrderJourneyView {
  const placedAt = order.created_at ?? events[0]?.created_at ?? null;
  const cancelEvent = [...events]
    .reverse()
    .find((event) => event.to_status?.toLowerCase() === "cancelled");

  return {
    steps: [
      buildStep({
        title: copy.transactions.journeyStepOrderPlaced,
        description: null,
        toStatus: copy.transactions.journeyStatusDone,
        badgeVariant: "success",
        isComplete: true,
        createdAt: placedAt,
      }),
      buildStep({
        title: copy.transactions.journeyStepPaymentNotCompleted,
        description: copy.transactions.journeyStepPaymentNotCompletedDescription,
        actor: "You",
        toStatus: copy.transactions.journeyStatusFailed,
        badgeVariant: "destructive",
        isTerminal: true,
        isComplete: false,
        createdAt: cancelEvent?.created_at ?? placedAt,
      }),
    ],
  };
}

function buildActiveLumpsumJourney(order: MfOrder, events: MfOrderEvent[]): OrderJourneyView {
  const placedAt = order.created_at ?? events[0]?.created_at ?? null;
  const paymentCompletedAt =
    findTimestamp(
      order,
      events,
      (event) =>
        event.source?.toUpperCase() === "RECONCILE" ||
        payloadString(event.payload?.repair) === "abandoned_paid",
    ) ??
    findTimestamp(order, events, (event) => payloadString(event.payload?.stage) === "payment_success") ??
    findTimestamp(order, events, (event) => event.to_status?.toUpperCase() === "SUBMITTED") ??
    placedAt;

  const steps: JourneyDisplayStep[] = [
    buildStep({
      title: copy.transactions.journeyStepOrderPlaced,
      description: null,
      toStatus: copy.transactions.journeyStatusDone,
      badgeVariant: "success",
      isComplete: true,
      createdAt: placedAt,
    }),
  ];

  if (!hasPaymentCompleted(order, events)) {
    const cybrillaLabel = resolveCybrillaOrderStatusLabel(order);
    const normalizedStatus = order.status?.trim().toUpperCase() ?? "";
    const isFailed = normalizedStatus === "FAILED" || normalizedStatus === "CANCELLED";

    steps.push(
      buildStep({
        title: isFailed ? copy.transactions.journeyStatusFailed : cybrillaLabel,
        description: isFailed
          ? order.failure_reason ?? copy.transactions.journeyStepPaymentNotCompletedDescription
          : formatCybrillaStatusLabel(order.fp_payment_status)
            ? `Payment status from gateway: ${formatCybrillaStatusLabel(order.fp_payment_status)}`
            : formatCybrillaStatusLabel(order.fp_state)
              ? `Purchase status: ${formatCybrillaStatusLabel(order.fp_state)}`
              : null,
        toStatus: isFailed ? copy.transactions.journeyStatusFailed : cybrillaLabel,
        badgeVariant: isFailed ? "destructive" : "warning",
        isTerminal: isFailed,
        isComplete: false,
        createdAt: placedAt,
      }),
    );
    return { steps };
  }

  steps.push(
    buildStep({
      title: copy.transactions.journeyStepPaymentCompleted,
      description: copy.transactions.journeyStepPaymentCompletedDescription,
      toStatus: copy.transactions.journeyStatusPaymentCompleted,
      badgeVariant: "success",
      isComplete: true,
      createdAt: paymentCompletedAt,
    }),
  );

  if (order.status?.toUpperCase() === "SUCCEEDED") {
    const allottedAt =
      findTimestamp(order, events, (event) => event.to_status?.toUpperCase() === "SUCCEEDED") ??
      order.settled_at ??
      paymentCompletedAt;

    steps.push(
      buildStep({
        title: copy.transactions.journeyStepUnitsAllotted,
        description: copy.transactions.journeyStepUnitsAllottedDescription,
        toStatus: copy.transactions.journeyStatusCompleted,
        badgeVariant: "success",
        isComplete: true,
        createdAt: allottedAt,
      }),
    );
    return { steps };
  }

  if (order.status?.toUpperCase() === "FAILED") {
    if (hasPaymentCompleted(order, events)) {
      steps.push(
        buildStep({
          title: copy.transactions.journeyStepAwaitingAllotment,
          description: copy.transactions.journeyStepAwaitingAllotmentDescription,
          toStatus: copy.transactions.journeyStatusInProgress,
          badgeVariant: "info",
          isComplete: false,
          createdAt: paymentCompletedAt,
        }),
      );
      return { steps };
    }

    steps.push(
      buildStep({
        title: copy.transactions.journeyStatusFailed,
        description: order.failure_reason ?? null,
        toStatus: copy.transactions.journeyStatusFailed,
        badgeVariant: "destructive",
        isTerminal: true,
        isComplete: false,
        createdAt: events.at(-1)?.created_at ?? placedAt,
      }),
    );
    return { steps };
  }

  steps.push(
    buildStep({
      title: copy.transactions.journeyStepAwaitingAllotment,
      description: copy.transactions.journeyStepAwaitingAllotmentDescription,
      toStatus: copy.transactions.journeyStatusInProgress,
      badgeVariant: "info",
      isComplete: false,
      createdAt: paymentCompletedAt,
    }),
  );

  return { steps };
}

export function formatEventSource(source?: string | null) {
  if (!source) return "Zynd";
  return SOURCE_LABELS[source.toUpperCase()] ?? "Zynd";
}

function buildRedemptionOrderJourney(order: MfOrder, events: MfOrderEvent[]): OrderJourneyView {
  const portfolioCopy = copy.dashboard.portfolio;
  const placedAt = order.created_at ?? events[0]?.created_at ?? null;
  const status = order.status?.trim().toUpperCase() ?? "";
  const confirmed = events.some((event) => {
    const stage = payloadString(event.payload?.stage);
    return (
      stage === "confirmed" ||
      event.to_status?.toUpperCase() === "PROCESSING" ||
      event.to_status?.toUpperCase() === "SUBMITTED" ||
      event.to_status?.toUpperCase() === "SUCCEEDED"
    );
  });
  const fpState = redemptionFpState(order);
  const isFailed = isRedemptionOrderFailed(order);
  const isSubmitted = status === "SUBMITTED" || fpState === "submitted";
  const isConfirmed =
    confirmed ||
    isSubmitted ||
    status === "PROCESSING" ||
    fpState === "confirmed" ||
    fpState === "processing" ||
    fpState === "under_review" ||
    fpState === "review";

  const steps: JourneyDisplayStep[] = [
    buildStep({
      title: portfolioCopy.redeemJourneyStepPlaced,
      description: portfolioCopy.redeemJourneyPlacedDescription,
      toStatus: copy.transactions.journeyStatusDone,
      badgeVariant: "success",
      isComplete: true,
      createdAt: placedAt,
    }),
  ];

  if (isFailed && !isSubmitted && status !== "SUCCEEDED") {
    steps.push(
      buildStep({
        title: portfolioCopy.redeemJourneyStepFailed,
        description: redemptionFailureLabel(order),
        toStatus: copy.transactions.journeyStatusFailed,
        badgeVariant: "destructive",
        isTerminal: true,
        isComplete: false,
        createdAt: events.at(-1)?.created_at ?? placedAt,
      }),
    );
    return { steps };
  }

  if (isRedemptionAwaitingConsent(order) && status !== "SUCCEEDED" && !isSubmitted) {
    steps.push(
      buildStep({
        title: portfolioCopy.redeemJourneyStepAwaitingConsent,
        description: portfolioCopy.redeemJourneyAwaitingConsentDescription,
        toStatus: portfolioCopy.redeemJourneyStatusAwaitingConsent,
        badgeVariant: "warning",
        isComplete: false,
        createdAt: placedAt,
      }),
    );
    return { steps };
  }

  if (status === "SUCCEEDED") {
    steps.push(
      buildStep({
        title: portfolioCopy.redeemJourneyStepPayoutCredited,
        description: portfolioCopy.redeemJourneyPayoutCreditedDescription,
        toStatus: copy.transactions.journeyStatusCompleted,
        badgeVariant: "success",
        isComplete: true,
        createdAt: order.settled_at ?? events.at(-1)?.created_at ?? placedAt,
      }),
    );
    return { steps };
  }

  if (isFailed) {
    if (isConfirmed) {
      steps.push(
        buildStep({
          title: isSubmitted
            ? portfolioCopy.redeemJourneyStepAmcSubmitted
            : portfolioCopy.redeemJourneyStepProcessing,
          description: isSubmitted
            ? portfolioCopy.redeemJourneyAmcSubmittedDescription
            : portfolioCopy.redeemJourneyOutcomeProcessing,
          toStatus: copy.transactions.journeyStatusDone,
          badgeVariant: "success",
          isComplete: true,
          createdAt: events.at(-1)?.created_at ?? placedAt,
        }),
      );
    }
    steps.push(
      buildStep({
        title: portfolioCopy.redeemJourneyStepFailed,
        description: redemptionFailureLabel(order),
        toStatus: copy.transactions.journeyStatusFailed,
        badgeVariant: "destructive",
        isTerminal: true,
        isComplete: false,
        createdAt: events.at(-1)?.created_at ?? placedAt,
      }),
    );
    return { steps };
  }

  steps.push(
    buildStep({
      title: isSubmitted
        ? portfolioCopy.redeemJourneyStepAmcSubmitted
        : portfolioCopy.redeemJourneyStepProcessing,
      description: isSubmitted
        ? portfolioCopy.redeemJourneyAmcSubmittedDescription
        : portfolioCopy.redeemJourneyOutcomeProcessing,
      toStatus: copy.transactions.journeyStatusInProgress,
      badgeVariant: "info",
      isComplete: false,
      createdAt: events.at(-1)?.created_at ?? placedAt,
    }),
  );
  return { steps };
}

export function buildOrderJourneyView(order: MfOrder, events: MfOrderEvent[]): OrderJourneyView {
  if (isRedemptionOrder(order)) {
    return buildRedemptionOrderJourney(order, events);
  }

  const paymentAbandoned = isPaymentAbandoned(order, events);
  if (paymentAbandoned && !wasRepairedAfterAbandon(events)) {
    return buildAbandonedJourney(order, events);
  }

  return buildActiveLumpsumJourney(order, events);
}

export function formatMfOrderStatusLabel(
  status: string,
  order?: Pick<MfOrder, "fp_state" | "fp_payment_status" | "payment_completed" | "status" | "order_type">,
) {
  const normalized = (order?.status ?? status).trim().toUpperCase();

  if (order && isRedemptionOrder(order)) {
    if (isTerminalRedemptionFpFailure(order)) {
      return redemptionFailureLabel(order);
    }
    const fpState = redemptionFpState(order);
    if (fpState === "submitted" || normalized === "SUBMITTED") {
      return formatCybrillaStatusLabel(order.fp_state) ?? "Submitted";
    }
    if (isRedemptionAwaitingConsent(order)) {
      return copy.dashboard.portfolio.redeemJourneyStatusAwaitingConsent;
    }
  }

  if (order) {
    if (isOrderPaymentCompleted(order)) {
      if (normalized === "SUCCEEDED") return copy.transactions.journeyStatusCompleted;
      if (isOrderAwaitingAllotment(order)) return copy.transactions.journeyStatusInProgress;
      if (normalized === "PROCESSING" || normalized === "SUBMITTED") {
        return copy.transactions.journeyStatusInProgress;
      }
    }
    return resolveCybrillaOrderStatusLabel({ ...order, status: order.status ?? status });
  }

  return status
    .trim()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function mfOrderStatusVariantForInvestor(
  status: string,
  order?: Pick<MfOrder, "fp_state" | "fp_payment_status" | "payment_completed" | "status" | "order_type">,
): StatusBadgeVariant {
  const normalized = status.trim().toUpperCase();
  if (order && isRedemptionOrder(order)) {
    if (isTerminalRedemptionFpFailure(order)) return "destructive";
    if (normalized === "SUCCEEDED" || redemptionFpState(order) === "successful") return "success";
    if (isRedemptionOrderFailed(order)) {
      return "destructive";
    }
    if (normalized === "SUBMITTED" || redemptionFpState(order) === "submitted") return "info";
    if (isRedemptionAwaitingConsent(order)) return "warning";
    return "info";
  }
  if (normalized === "SUCCEEDED") return "success";
  if (normalized === "FAILED" || normalized === "CANCELLED") return "destructive";
  if (order && isOrderPaymentCompleted(order)) {
    if (isOrderAwaitingAllotment(order)) return "info";
    if (normalized === "PROCESSING" || normalized === "SUBMITTED") return "info";
  }
  if (order && !isOrderPaymentCompleted(order)) {
    const paymentStatus = order.fp_payment_status?.trim().toUpperCase() ?? "";
    if (["FAILED", "EXPIRED", "CANCELLED", "REJECTED", "DECLINED"].includes(paymentStatus)) {
      return "destructive";
    }
    return "warning";
  }
  if (normalized === "PAYMENT_PENDING" || normalized === "PENDING" || normalized === "PROCESSING") {
    return "warning";
  }
  return "neutral";
}
