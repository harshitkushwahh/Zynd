import type { MfSipPlan, MfSipPlanEvent } from "@/features/invest/api/invest-api";
import { formatEventSource } from "@/features/invest/lib/mf-order-journey-copy";
import { resolveSipJourneyErrorDescription } from "@/features/invest/lib/mf-sip-failure-copy";

export type SipPlanJourneyDisplayStep = {
  event: MfSipPlanEvent;
  title: string;
  description: string | null;
  actor: string;
  toStatus: string;
  isTerminal: boolean;
};

export type SipPlanJourneyView = {
  steps: SipPlanJourneyDisplayStep[];
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

function isMandateAbandoned(plan: MfSipPlan, events: MfSipPlanEvent[]) {
  if (plan.failure_code === "mandate_abandoned") return true;

  const lastEvent = events[events.length - 1];
  if (
    plan.status?.toUpperCase() === "CANCELLED" &&
    lastEvent?.to_status?.toUpperCase() === "CANCELLED" &&
    lastEvent.source?.toUpperCase() === "USER"
  ) {
    return true;
  }

  return events.some((event) => payloadString(event.payload?.reason) === "mandate_abandoned");
}

function isTerminalStatus(status?: string | null) {
  const normalized = status?.toLowerCase();
  return normalized === "cancelled" || normalized === "failed";
}

function describePayload(
  payload: Record<string, unknown> | null | undefined,
  options?: { mandateAbandoned?: boolean; plan?: MfSipPlan },
) {
  if (!payload) return null;

  const reason = payloadString(payload.reason);
  if (reason === "mandate_abandoned") {
    return "Mandate authorization was not completed.";
  }

  if (reason) {
    return reason.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  const fpState = payloadString(payload.fp_state);
  if (options?.mandateAbandoned) return null;

  if (fpState) {
    return `Provider status: ${titleCaseStatus(fpState).toLowerCase()}.`;
  }

  const error = payloadString(payload.error);
  if (error) return resolveSipJourneyErrorDescription(error, options?.plan);

  return null;
}

function describeTransition(
  fromStatus: string | null | undefined,
  toStatus: string,
  options?: { mandateAbandoned?: boolean; isCancelStep?: boolean },
) {
  const from = fromStatus?.toLowerCase();
  const to = toStatus.toLowerCase();

  if (options?.isCancelStep && options.mandateAbandoned) {
    return "Mandate authorization closed";
  }

  if (!from) {
    if (to === "pending") return "SIP plan created";
    if (to === "review") return "Under review";
    if (to === "consent_pending") return "Awaiting mandate authorization";
    if (to === "active") return "SIP activated";
    if (to === "failed") return "SIP setup failed";
    if (to === "cancelled") return "SIP cancelled";
    return `Moved to ${titleCaseStatus(to)}`;
  }

  if (from === "pending" && to === "review") return "Sent for review";
  if (from === "pending" && to === "consent_pending") return "Awaiting mandate authorization";
  if (from === "consent_pending" && to === "active") return "SIP activated";
  if (from === "review" && to === "active") return "SIP activated";
  if (to === "cancelled") return options?.mandateAbandoned ? "Mandate authorization closed" : "SIP cancelled";
  if (to === "failed") return "SIP setup failed";
  if (to === "active") return "SIP activated";

  return `${titleCaseStatus(from)} to ${titleCaseStatus(to)}`;
}

function toDisplayStep(
  event: MfSipPlanEvent,
  options?: { mandateAbandoned?: boolean; isCancelStep?: boolean; plan?: MfSipPlan },
): SipPlanJourneyDisplayStep {
  const mandateAbandoned = options?.mandateAbandoned ?? false;
  const isCancelStep = options?.isCancelStep ?? false;
  let description = describePayload(event.payload, { mandateAbandoned, plan: options?.plan });

  if (mandateAbandoned && !description && event.to_status === "consent_pending") {
    description = "You were redirected to authorize your UPI mandate.";
  }

  return {
    event,
    title: describeTransition(event.from_status, event.to_status, {
      mandateAbandoned,
      isCancelStep,
    }),
    description,
    actor: formatEventSource(event.source),
    toStatus: titleCaseStatus(event.to_status),
    isTerminal: isTerminalStatus(event.to_status),
  };
}

function pickAbandonedJourneyEvents(events: MfSipPlanEvent[]) {
  if (events.length === 0) return [];

  const selected: MfSipPlanEvent[] = [];
  const first = events[0];
  selected.push(first);

  const consentEvent = events.find((event) => event.to_status === "consent_pending");
  if (consentEvent && consentEvent !== first) {
    selected.push(consentEvent);
  }

  const cancelEvent = [...events]
    .reverse()
    .find((event) => event.to_status?.toLowerCase() === "cancelled");
  if (cancelEvent) {
    selected.push(cancelEvent);
  }

  return selected;
}

export function buildSipPlanJourneyView(plan: MfSipPlan, events: MfSipPlanEvent[]): SipPlanJourneyView {
  const mandateAbandoned = isMandateAbandoned(plan, events);
  const displayEvents = mandateAbandoned ? pickAbandonedJourneyEvents(events) : events;

  const steps = displayEvents
    .map((event, index) =>
      toDisplayStep(event, {
        mandateAbandoned,
        plan,
        isCancelStep:
          mandateAbandoned &&
          event.to_status === "cancelled" &&
          index === displayEvents.length - 1,
      }),
    )
    .filter((step, index, all) => {
      if (index === 0) return true;
      const previous = all[index - 1];
      return !(
        step.toStatus === "Failed" &&
        previous.toStatus === "Failed" &&
        step.title === previous.title &&
        step.description === previous.description
      );
    });

  return { steps };
}
