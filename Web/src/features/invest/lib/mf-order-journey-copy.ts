import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { MfOrder, MfOrderEvent } from "@/features/invest/api/invest-api";
import {
  formatCybrillaStatusLabel,
  resolveCybrillaOrderStatusLabel,
} from "@/features/invest/lib/mf-cybrilla-status";
import {
  isMfPurchaseOrderAwaitingPayment,
  isMfPurchaseOrderPaymentFailed,
  isOrderAwaitingAllotment,
  isOrderPaymentCompleted,
  type MfOrderInvestorStatusContext,
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
  /** Compact from→to fund names shown inside the first switch timeline step. */
  switchPath?: { from: string; to: string };
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

function isSwitchOrder(order: Pick<MfOrder, "order_type">) {
  return order.order_type?.trim().toUpperCase() === "SWITCH";
}

export function switchFundNames(order: MfOrder): { from: string; to: string } | null {
  const from = (order.switch_out_product_name ?? order.product_name)?.trim();
  const to = order.switch_in_product_name?.trim();
  if (!from || !to) return null;
  return { from, to };
}

export function hasSwitchPath(order: MfOrder): boolean {
  return isSwitchOrder(order) && switchFundNames(order) !== null;
}

function switchDescription(template: string, order: MfOrder, fallback: string) {
  const names = switchFundNames(order);
  if (!names) return fallback;
  return template.replace("{from}", names.from).replace("{to}", names.to);
}

function isConsentFundOrder(order: Pick<MfOrder, "order_type">) {
  return isRedemptionOrder(order) || isSwitchOrder(order);
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

function orderHasPlatformConsent(order: MfOrder, events: MfOrderEvent[]): boolean {
  if (order.platform_consent_accepted) return true;
  if (order.switch_confirmed) return true;
  if (order.redemption_confirmed) return true;
  return events.some((event) => payloadString(event.payload?.stage) === "confirmed");
}

function switchAwaitingOtp(order: MfOrder, events: MfOrderEvent[]): boolean {
  if (!isSwitchOrder(order)) return false;
  if (orderHasPlatformConsent(order, events)) return false;
  const status = order.status?.trim().toUpperCase() ?? "";
  return status !== "SUCCEEDED";
}

function redemptionAwaitingOtp(order: MfOrder, events: MfOrderEvent[]): boolean {
  if (!isRedemptionOrder(order)) return false;
  if (orderHasPlatformConsent(order, events)) return false;
  if (isTerminalRedemptionFpFailure(order)) return false;
  const status = order.status?.trim().toUpperCase() ?? "";
  if (status === "SUCCEEDED") return false;
  const fpState = redemptionFpState(order);
  if (status === "SUBMITTED" || fpState === "submitted") return false;
  return isRedemptionAwaitingConsent(order);
}

function consentOrderAwaitingOtpFromOrder(order: MfOrderInvestorStatusContext): boolean {
  if (!isConsentFundOrder(order)) return false;
  if (order.platform_consent_accepted || order.switch_confirmed || order.redemption_confirmed) {
    return false;
  }
  if (isTerminalRedemptionFpFailure(order)) return false;
  const status = order.status?.trim().toUpperCase() ?? "";
  if (status === "SUCCEEDED") return false;
  if (isSwitchOrder(order)) return true;
  return isRedemptionAwaitingConsent(order);
}

function isRedemptionOrderFailed(order: Pick<MfOrder, "status" | "fp_state">) {
  if (isTerminalRedemptionFpFailure(order)) return true;
  const status = order.status?.trim().toUpperCase() ?? "";
  return (status === "FAILED" || status === "CANCELLED") && !isLiveRedemptionFpState(order);
}

/** Long-form copy for journey timeline steps only — not for status badges. */
function consentOrderFailureDescription(
  order: Pick<MfOrder, "fp_state" | "order_type" | "failure_code"> & {
    failure_reason?: string | null;
  },
) {
  const code = order.failure_code?.trim().toLowerCase();
  const portfolioCopy = copy.dashboard.portfolio;
  if (code === "amount_invalid" || code === "below_minimum") {
    return isSwitchOrder(order)
      ? portfolioCopy.holdingSwitchFailureAmountInvalid
      : portfolioCopy.redeemFailureAmountInvalid;
  }
  if (code === "units_invalid") {
    return isSwitchOrder(order)
      ? portfolioCopy.holdingSwitchFailureUnitsInvalid
      : portfolioCopy.redeemFailureUnitsInvalid;
  }
  const reason = order.failure_reason?.trim();
  if (reason && reason.toLowerCase() !== redemptionFpState(order)) {
    return reason;
  }
  return formatCybrillaStatusLabel(order.fp_state) ?? copy.transactions.journeyStatusFailed;
}

function redemptionFailureLabel(
  order: Pick<MfOrder, "fp_state" | "order_type" | "failure_code"> & {
    failure_reason?: string | null;
  },
) {
  return consentOrderFailureDescription(order);
}

function consentOrderFailureBadgeLabel(
  order: Pick<MfOrder, "fp_state" | "status">,
) {
  return formatCybrillaStatusLabel(order.fp_state) ?? copy.transactions.journeyStatusFailed;
}

function isPaymentAbandoned(order: MfOrder, events: MfOrderEvent[]) {
  if (isConsentFundOrder(order)) return false;
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
  switchPath?: { from: string; to: string };
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
    switchPath: args.switchPath,
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
  const isSwitch = isSwitchOrder(order);
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

  const switchPath = isSwitch ? switchFundNames(order) : null;
  const awaitingSwitchOtp = switchAwaitingOtp(order, events);
  const awaitingRedemptionOtp = redemptionAwaitingOtp(order, events);
  const awaitingConsentOtp = awaitingSwitchOtp || awaitingRedemptionOtp;

  const steps: JourneyDisplayStep[] = [
    buildStep({
      title: isSwitch
        ? awaitingSwitchOtp
          ? portfolioCopy.holdingSwitchJourneyStepDraft
          : portfolioCopy.holdingSwitchJourneyStepPlaced
        : awaitingRedemptionOtp
          ? portfolioCopy.redeemJourneyStepDraft
          : portfolioCopy.redeemJourneyStepPlaced,
      description: isSwitch
        ? awaitingSwitchOtp
          ? portfolioCopy.holdingSwitchJourneyDraftDescription
          : portfolioCopy.holdingSwitchJourneyPlacedDescription
        : awaitingRedemptionOtp
          ? portfolioCopy.redeemJourneyDraftDescription
          : portfolioCopy.redeemJourneyPlacedDescription,
      switchPath: switchPath ?? undefined,
      toStatus: copy.transactions.journeyStatusDone,
      badgeVariant: "success",
      isComplete: true,
      createdAt: placedAt,
    }),
  ];

  if (awaitingConsentOtp) {
    if (isFailed && !isSubmitted && status !== "SUCCEEDED") {
      steps.push(
        buildStep({
          title: isSwitch
            ? portfolioCopy.holdingSwitchJourneyStepFailed
            : portfolioCopy.redeemJourneyStepFailed,
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
        title: portfolioCopy.redeemJourneyStepAwaitingConsent,
        description: isSwitch
          ? portfolioCopy.holdingSwitchJourneyAwaitingConsentDescription
          : portfolioCopy.redeemJourneyAwaitingConsentDescription,
        toStatus: portfolioCopy.redeemJourneyStatusAwaitingConsent,
        badgeVariant: "warning",
        isComplete: false,
        createdAt: placedAt,
      }),
    );
    return { steps };
  }

  if (isFailed && !isSubmitted && status !== "SUCCEEDED") {
    steps.push(
      buildStep({
        title: isSwitch ? portfolioCopy.holdingSwitchJourneyStepFailed : portfolioCopy.redeemJourneyStepFailed,
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

  if (status === "SUCCEEDED") {
    steps.push(
      buildStep({
        title: isSwitch
          ? portfolioCopy.holdingSwitchJourneyStepCompleted
          : portfolioCopy.redeemJourneyStepPayoutCredited,
        description: isSwitch
          ? portfolioCopy.holdingSwitchJourneyCompletedDescription
          : portfolioCopy.redeemJourneyPayoutCreditedDescription,
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
            : isSwitch
              ? portfolioCopy.holdingSwitchJourneyStepProcessing
              : portfolioCopy.redeemJourneyStepProcessing,
          description: isSubmitted
            ? isSwitch
              ? switchDescription(
                  copy.transactions.journeySwitchSubmittedDescription,
                  order,
                  portfolioCopy.holdingSwitchJourneyAmcSubmittedDescription,
                )
              : portfolioCopy.redeemJourneyAmcSubmittedDescription
            : isSwitch
              ? portfolioCopy.holdingSwitchJourneyProcessingDescription
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
        title: isSwitch ? portfolioCopy.holdingSwitchJourneyStepFailed : portfolioCopy.redeemJourneyStepFailed,
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
        : isSwitch
          ? portfolioCopy.holdingSwitchJourneyStepProcessing
          : portfolioCopy.redeemJourneyStepProcessing,
      description: isSubmitted
        ? isSwitch
          ? switchDescription(
              copy.transactions.journeySwitchSubmittedDescription,
              order,
              portfolioCopy.holdingSwitchJourneyAmcSubmittedDescription,
            )
          : portfolioCopy.redeemJourneyAmcSubmittedDescription
        : isSwitch
          ? portfolioCopy.holdingSwitchJourneyProcessingDescription
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
  if (isConsentFundOrder(order)) {
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
  order?: MfOrderInvestorStatusContext,
) {
  const normalized = (order?.status ?? status).trim().toUpperCase();

  if (order && isConsentFundOrder(order)) {
    if (isTerminalRedemptionFpFailure(order) || isRedemptionOrderFailed(order)) {
      return consentOrderFailureBadgeLabel(order);
    }
    const fpState = redemptionFpState(order);
    if (fpState === "submitted" || normalized === "SUBMITTED") {
      return formatCybrillaStatusLabel(order.fp_state) ?? "Submitted";
    }
    if (consentOrderAwaitingOtpFromOrder(order)) {
      return copy.dashboard.portfolio.redeemJourneyStatusAwaitingConsent;
    }
  }

  if (order && !isConsentFundOrder(order)) {
    if (isMfPurchaseOrderPaymentFailed(order)) {
      if (order.failure_code === "payment_abandoned") {
        return copy.transactions.orderStatusPaymentCanceled;
      }
      return copy.transactions.journeyStatusFailed;
    }
    if (isMfPurchaseOrderAwaitingPayment(order)) {
      return copy.transactions.orderStatusPending;
    }
    if (isOrderPaymentCompleted(order)) {
      if (normalized === "SUCCEEDED") return copy.transactions.journeyStatusCompleted;
      if (isOrderAwaitingAllotment(order)) return copy.transactions.journeyStatusInProgress;
      if (normalized === "PROCESSING" || normalized === "SUBMITTED") {
        return copy.transactions.journeyStatusInProgress;
      }
    }
    return resolveCybrillaOrderStatusLabel({ ...order, status: order.status ?? status });
  }

  if (order) {
    return resolveCybrillaOrderStatusLabel({ ...order, status: order.status ?? status });
  }

  return status
    .trim()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function mfOrderStatusVariantForInvestor(
  status: string,
  order?: MfOrderInvestorStatusContext,
): StatusBadgeVariant {
  const normalized = status.trim().toUpperCase();
  if (order && isConsentFundOrder(order)) {
    if (isTerminalRedemptionFpFailure(order)) return "destructive";
    if (normalized === "SUCCEEDED" || redemptionFpState(order) === "successful") return "success";
    if (isRedemptionOrderFailed(order)) {
      return "destructive";
    }
    if (normalized === "SUBMITTED" || redemptionFpState(order) === "submitted") return "info";
    if (consentOrderAwaitingOtpFromOrder(order)) return "warning";
    return "info";
  }
  if (normalized === "SUCCEEDED") return "success";
  if (order && !isConsentFundOrder(order)) {
    if (isMfPurchaseOrderPaymentFailed(order)) return "destructive";
    if (isMfPurchaseOrderAwaitingPayment(order)) return "warning";
    if (isOrderPaymentCompleted(order)) {
      if (isOrderAwaitingAllotment(order)) return "info";
      if (normalized === "PROCESSING" || normalized === "SUBMITTED") return "info";
    }
  }
  if (normalized === "FAILED" || normalized === "CANCELLED") return "destructive";
  if (order && isOrderPaymentCompleted(order)) {
    if (isOrderAwaitingAllotment(order)) return "info";
    if (normalized === "PROCESSING" || normalized === "SUBMITTED") return "info";
  }
  if (normalized === "PAYMENT_PENDING" || normalized === "PENDING" || normalized === "PROCESSING") {
    return "warning";
  }
  return "neutral";
}
