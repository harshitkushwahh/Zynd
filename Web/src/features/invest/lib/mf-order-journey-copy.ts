import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { MfOrder, MfOrderEvent } from "@/features/invest/api/invest-api";
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

function isPaymentAbandoned(order: MfOrder, events: MfOrderEvent[]) {
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
  const status = order.status?.toUpperCase();
  if (status === "SUCCEEDED" || status === "SUBMITTED") return true;
  if (status === "CANCELLED" || status === "FAILED") {
    return wasRepairedAfterAbandon(events);
  }

  return events.some((event) => event.to_status?.toUpperCase() === "SUBMITTED");
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
    steps.push(
      buildStep({
        title: copy.transactions.journeyStepAwaitingPayment,
        description: copy.transactions.journeyStepAwaitingPaymentDescription,
        toStatus: copy.transactions.journeyStatusAwaitingPayment,
        badgeVariant: "warning",
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

export function buildOrderJourneyView(order: MfOrder, events: MfOrderEvent[]): OrderJourneyView {
  const paymentAbandoned = isPaymentAbandoned(order, events);
  if (paymentAbandoned && !wasRepairedAfterAbandon(events)) {
    return buildAbandonedJourney(order, events);
  }

  return buildActiveLumpsumJourney(order, events);
}

export function formatMfOrderStatusLabel(status: string, order?: Pick<MfOrder, "fp_state">) {
  const normalized = status.trim().toUpperCase();
  if (normalized === "SUBMITTED") {
    return copy.transactions.orderStatusAwaitingAllotment;
  }
  if (normalized === "SUCCEEDED") {
    return copy.transactions.journeyStatusCompleted;
  }
  if (normalized === "CANCELLED" || normalized === "FAILED") {
    return normalized === "CANCELLED" ? "Cancelled" : "Failed";
  }
  if (normalized === "PAYMENT_PENDING") {
    return copy.transactions.journeyStatusAwaitingPayment;
  }
  if (normalized === "PROCESSING" && order?.fp_state?.toLowerCase() === "submitted") {
    return copy.transactions.orderStatusAwaitingAllotment;
  }
  return status
    .trim()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function mfOrderStatusVariantForInvestor(
  status: string,
  order?: Pick<MfOrder, "fp_state">,
): StatusBadgeVariant {
  const normalized = status.trim().toUpperCase();
  if (normalized === "SUCCEEDED") return "success";
  if (normalized === "FAILED" || normalized === "CANCELLED") return "destructive";
  if (normalized === "SUBMITTED") return "warning";
  if (normalized === "PROCESSING" && order?.fp_state?.toLowerCase() === "submitted") {
    return "warning";
  }
  if (normalized === "PAYMENT_PENDING" || normalized === "PENDING" || normalized === "PROCESSING") {
    return "warning";
  }
  return "neutral";
}
