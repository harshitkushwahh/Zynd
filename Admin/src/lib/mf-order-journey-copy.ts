import type { MfTransactionOrder, MfTransactionOrderEvent } from "@/lib/mf-transactions-admin-api";

const FAILURE_CODE_LABELS: Record<string, string> = {
  payment_abandoned: "Payment not completed",
  payment_failed: "Payment failed",
  payment_expired: "Payment window expired",
};

const SOURCE_LABELS: Record<string, string> = {
  SYSTEM: "System",
  WORKER: "Automatic sync",
  USER: "Customer",
  WEBHOOK: "Payment update",
};

const FP_STATE_LABELS: Record<string, string> = {
  pending: "Payment pending",
  under_review: "Under review",
  confirmed: "Payment confirmed",
  submitted: "Submitted to AMC",
  successful: "Successful",
  succeeded: "Successful",
  failed: "Failed",
  cancelled: "Cancelled",
};

export type JourneyDisplayStep = {
  event: MfTransactionOrderEvent;
  title: string;
  description: string | null;
  actor: string;
  toStatus: string;
  isTerminal: boolean;
};

export type OrderJourneyView = {
  steps: JourneyDisplayStep[];
  hiddenStepCount: number;
  outcomeSummary: string | null;
  providerStatusLabel: string;
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

function isPaymentAbandoned(order: MfTransactionOrder, events: MfTransactionOrderEvent[]) {
  if (order.failure_code === "payment_abandoned") return true;

  const lastEvent = events[events.length - 1];
  if (
    order.status?.toLowerCase() === "cancelled" &&
    lastEvent?.to_status?.toLowerCase() === "cancelled" &&
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

function isTerminalOrder(status?: string | null) {
  const normalized = status?.toLowerCase();
  return normalized === "cancelled" || normalized === "failed" || normalized === "succeeded";
}

function describePayload(
  payload: Record<string, unknown> | null | undefined,
  options?: { paymentAbandoned?: boolean },
) {
  if (!payload) return null;

  const stage = payloadString(payload.stage);
  const fpState = payloadString(payload.fp_state);
  const reason = payloadString(payload.reason);
  const error = payloadString(payload.error);
  const code = payloadString(payload.code);
  const batch = payload.batch === true;

  if (reason === "payment_abandoned") {
    return "Customer left checkout without completing payment.";
  }

  if (reason) {
    return (
      FAILURE_CODE_LABELS[reason] ??
      reason.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())
    );
  }

  if (error) {
    return code ? `${error} (${code})` : error;
  }

  if (options?.paymentAbandoned) {
    return null;
  }

  if (stage === "poll" && fpState === "pending") {
    return "Checking payment status with the provider.";
  }

  if (stage === "confirm_batch" && fpState === "confirmed") {
    return "Payment confirmed as part of a checkout batch.";
  }

  if (stage === "poll" && fpState === "submitted") {
    return "Provider accepted the order and submitted it to the AMC.";
  }

  if (stage === "poll" && fpState) {
    return `Provider reported status as ${formatFpState(fpState).toLowerCase()}.`;
  }

  if (stage === "confirm") {
    return "Confirming the order with the provider.";
  }

  if (stage === "consent") {
    return "Waiting for customer consent to proceed.";
  }

  if (stage === "sync") {
    return "Syncing the latest status from the provider.";
  }

  if (batch && fpState === "under_review") {
    return "Order queued in a batch for provider review.";
  }

  if (fpState) {
    return `Provider state updated to ${formatFpState(fpState).toLowerCase()}.`;
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
    if (to === "payment_pending") return "Awaiting customer payment";
    if (to === "submitted") return "Submitted to AMC";
    if (to === "succeeded") return "Investment completed";
    if (to === "failed") return "Order failed";
    if (to === "cancelled") return "Order cancelled";
    return `Moved to ${titleCaseStatus(to)}`;
  }

  if (from === "pending" && to === "processing") {
    return options?.paymentAbandoned ? "Checkout prepared" : "Sent for processing";
  }

  if (from === "processing" && to === "payment_pending") {
    return "Awaiting customer payment";
  }

  if (from === "payment_pending" && to === "processing") {
    return options?.paymentAbandoned
      ? "Provider sync in progress"
      : "Payment received";
  }

  if (from === "processing" && to === "submitted") {
    return options?.paymentAbandoned
      ? "Provider sync in progress"
      : "Submitted to AMC";
  }

  if (from === "submitted" && to === "succeeded") return "Units allotted";
  if (to === "cancelled") return options?.paymentAbandoned ? "Checkout closed" : "Order cancelled";
  if (to === "failed") return "Order failed";
  if (to === "succeeded") return "Investment completed";

  return `${titleCaseStatus(from)} to ${titleCaseStatus(to)}`;
}

function toDisplayStep(
  event: MfTransactionOrderEvent,
  options?: { paymentAbandoned?: boolean; isCancelStep?: boolean },
): JourneyDisplayStep {
  const paymentAbandoned = options?.paymentAbandoned ?? false;
  const isCancelStep = options?.isCancelStep ?? false;

  let description = describePayload(event.payload ?? null, { paymentAbandoned });

  if (paymentAbandoned && !description && event.to_status === "payment_pending") {
    description = "Customer was redirected to complete payment.";
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

function pickAbandonedJourneyEvents(events: MfTransactionOrderEvent[]) {
  if (events.length === 0) return [];

  const selected: MfTransactionOrderEvent[] = [];
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

export function formatFriendlyStatus(status?: string | null) {
  return titleCaseStatus(status);
}

export function formatFpState(state?: string | null) {
  if (!state) return "Not available";
  return FP_STATE_LABELS[state.toLowerCase()] ?? titleCaseStatus(state);
}

export function resolveProviderStatusLabel(order: MfTransactionOrder) {
  if (order.failure_code === "payment_abandoned") {
    return formatFailureCode(order.failure_code) ?? "Payment not completed";
  }

  if (order.status?.toLowerCase() === "cancelled") {
    return "Cancelled";
  }

  if (order.status?.toLowerCase() === "failed") {
    return "Failed";
  }

  if (order.status?.toLowerCase() === "succeeded") {
    return "Completed";
  }

  if (isTerminalOrder(order.status)) {
    return formatFriendlyStatus(order.status);
  }

  return formatFpState(order.fp_state);
}

export function formatFailureCode(code?: string | null) {
  if (!code) return null;
  return FAILURE_CODE_LABELS[code] ?? titleCaseStatus(code);
}

export function formatFailureSummary(order: MfTransactionOrder) {
  const codeLabel = formatFailureCode(order.failure_code);
  const reason = order.failure_reason?.trim();

  if (order.failure_code === "payment_abandoned") {
    return {
      title: reason ?? codeLabel ?? "This order did not complete",
      detail: null,
    };
  }

  if (!reason) {
    return { title: codeLabel ?? "This order did not complete", detail: null };
  }

  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const normalizedCode = codeLabel ? normalize(codeLabel) : "";
  const normalizedReason = normalize(reason);

  if (
    !codeLabel ||
    normalizedReason === normalizedCode ||
    normalizedReason.includes(normalizedCode) ||
    normalizedCode.includes(normalizedReason)
  ) {
    return { title: reason, detail: null };
  }

  return { title: codeLabel, detail: reason };
}

export function formatEventSource(source?: string | null) {
  if (!source) return "Unknown";
  return SOURCE_LABELS[source.toUpperCase()] ?? titleCaseStatus(source);
}

export function buildOrderJourneyView(
  order: MfTransactionOrder,
  events: MfTransactionOrderEvent[],
): OrderJourneyView {
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
    outcomeSummary =
      "Cancelled because payment was not completed.";
  } else if (order.status?.toLowerCase() === "cancelled") {
    outcomeSummary = "This order was cancelled before completion.";
  } else if (order.status?.toLowerCase() === "failed") {
    outcomeSummary = "This order failed before completion.";
  } else if (order.status?.toLowerCase() === "succeeded") {
    outcomeSummary = "This order completed successfully.";
  }

  return {
    steps,
    hiddenStepCount: Math.max(0, events.length - displayEvents.length),
    outcomeSummary,
    providerStatusLabel: resolveProviderStatusLabel(order),
  };
}

export function describeOrderEvent(event: MfTransactionOrderEvent) {
  const step = toDisplayStep(event);
  return {
    title: step.title,
    description: step.description,
    actor: step.actor,
    toStatus: step.toStatus,
  };
}
