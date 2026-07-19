import type { MfOrder, MfOrderEvent } from "@/features/invest/api/invest-api";

const SOURCE_LABELS: Record<string, string> = {
  SYSTEM: "Zynd",
  WORKER: "Automatic update",
  USER: "You",
  WEBHOOK: "Payment update",
};

export type JourneyDisplayStep = {
  event: MfOrderEvent;
  title: string;
  description: string | null;
  actor: string;
  toStatus: string;
  isTerminal: boolean;
};

export type OrderJourneyView = {
  steps: JourneyDisplayStep[];
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

function isPaymentAbandoned(order: MfOrder, events: MfOrderEvent[]) {
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

function isTerminalStatus(status?: string | null) {
  const normalized = status?.toLowerCase();
  return normalized === "cancelled" || normalized === "failed";
}

function describePayload(
  payload: Record<string, unknown> | null | undefined,
  options?: { paymentAbandoned?: boolean },
) {
  if (!payload) return null;

  const reason = payloadString(payload.reason);
  if (reason === "payment_abandoned") {
    return "Payment was not completed.";
  }

  if (reason) {
    return reason.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  const fpState = payloadString(payload.fp_state);
  const stage = payloadString(payload.stage);

  if (options?.paymentAbandoned) return null;

  if (stage === "poll" && fpState === "pending") {
    return "Confirming your payment with the provider.";
  }

  if (stage === "poll" && fpState === "submitted") {
    return "Your order was submitted to the fund house.";
  }

  if (stage === "confirm") {
    return "Confirming your order.";
  }

  if (fpState) {
    return `Provider status: ${titleCaseStatus(fpState).toLowerCase()}.`;
  }

  return null;
}

function describeTransition(
  fromStatus: string | null | undefined,
  toStatus: string,
  options?: { paymentAbandoned?: boolean; isCancelStep?: boolean },
) {
  const from = fromStatus?.toLowerCase();
  const to = toStatus.toLowerCase();

  if (options?.isCancelStep && options.paymentAbandoned) {
    return "Checkout closed";
  }

  if (!from) {
    if (to === "pending") return "Order placed";
    if (to === "processing") return "Checkout prepared";
    if (to === "payment_pending") return "Awaiting payment";
    if (to === "submitted") return "Submitted to fund house";
    if (to === "succeeded") return "Investment completed";
    if (to === "failed") return "Order failed";
    if (to === "cancelled") return "Order cancelled";
    return `Moved to ${titleCaseStatus(to)}`;
  }

  if (from === "pending" && to === "processing") return "Sent for processing";
  if (from === "processing" && to === "payment_pending") return "Awaiting payment";
  if (from === "payment_pending" && to === "processing") {
    return options?.paymentAbandoned ? "Syncing payment status" : "Payment received";
  }
  if (from === "processing" && to === "submitted") return "Submitted to fund house";
  if (from === "submitted" && to === "succeeded") return "Units allotted";
  if (to === "cancelled") return options?.paymentAbandoned ? "Checkout closed" : "Order cancelled";
  if (to === "failed") return "Order failed";
  if (to === "succeeded") return "Investment completed";

  return `${titleCaseStatus(from)} to ${titleCaseStatus(to)}`;
}

function toDisplayStep(
  event: MfOrderEvent,
  options?: { paymentAbandoned?: boolean; isCancelStep?: boolean },
): JourneyDisplayStep {
  const paymentAbandoned = options?.paymentAbandoned ?? false;
  const isCancelStep = options?.isCancelStep ?? false;
  let description = describePayload(event.payload, { paymentAbandoned });

  if (paymentAbandoned && !description && event.to_status === "payment_pending") {
    description = "You were redirected to complete payment.";
  }

  return {
    event,
    title: describeTransition(event.from_status, event.to_status, {
      paymentAbandoned,
      isCancelStep,
    }),
    description,
    actor: formatEventSource(event.source),
    toStatus: titleCaseStatus(event.to_status),
    isTerminal: isTerminalStatus(event.to_status),
  };
}

function pickAbandonedJourneyEvents(events: MfOrderEvent[]) {
  if (events.length === 0) return [];

  const selected: MfOrderEvent[] = [];
  const first = events[0];
  selected.push(first);

  const paymentEvent = events.find((event) => event.to_status === "payment_pending");
  if (paymentEvent && paymentEvent !== first) {
    selected.push(paymentEvent);
  } else {
    const checkoutPrepared = events.find(
      (event) => event.from_status === "pending" && event.to_status === "processing",
    );
    if (checkoutPrepared && checkoutPrepared !== first) {
      selected.push(checkoutPrepared);
    }
  }

  const cancelEvent = [...events]
    .reverse()
    .find((event) => event.to_status?.toLowerCase() === "cancelled");
  if (cancelEvent) {
    selected.push(cancelEvent);
  }

  return selected;
}

export function formatEventSource(source?: string | null) {
  if (!source) return "Unknown";
  return SOURCE_LABELS[source.toUpperCase()] ?? titleCaseStatus(source);
}

export function buildOrderJourneyView(order: MfOrder, events: MfOrderEvent[]): OrderJourneyView {
  const paymentAbandoned = isPaymentAbandoned(order, events);
  const displayEvents = paymentAbandoned ? pickAbandonedJourneyEvents(events) : events;

  const steps = displayEvents.map((event, index) =>
    toDisplayStep(event, {
      paymentAbandoned,
      isCancelStep:
        paymentAbandoned &&
        event.to_status === "cancelled" &&
        index === displayEvents.length - 1,
    }),
  );

  let outcomeSummary: string | null = null;
  if (paymentAbandoned) {
    outcomeSummary = "Cancelled because payment was not completed.";
  } else if (order.status?.toLowerCase() === "cancelled") {
    outcomeSummary = "This order was cancelled before completion.";
  } else if (order.status?.toLowerCase() === "failed") {
    outcomeSummary = "This order failed before completion.";
  } else if (order.status?.toLowerCase() === "succeeded") {
    outcomeSummary = "This order completed successfully.";
  }

  return { steps, outcomeSummary };
}
