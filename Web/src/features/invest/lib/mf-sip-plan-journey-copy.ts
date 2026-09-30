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
  isSuccess?: boolean;
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
  options?: { mandateAbandoned?: boolean; plan?: MfSipPlan; compact?: boolean },
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
    if (options?.compact) {
      if (fpState.toLowerCase() === "active") {
        return "Your monthly SIP is now active.";
      }
      return null;
    }
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
  if (from === "consent_pending" && to === "active") return "SIP activated";
  if (to === "cancelled") return options?.mandateAbandoned ? "Mandate authorization closed" : "SIP cancelled";
  if (to === "failed") return "SIP setup failed";
  if (to === "active") return "SIP activated";

  return `${titleCaseStatus(from)} to ${titleCaseStatus(to)}`;
}

function providerStatusLabel(event: MfSipPlanEvent): string | null {
  const fpState = payloadString(event.payload?.fp_state);
  return fpState ? titleCaseStatus(fpState) : null;
}

function toDisplayStep(
  event: MfSipPlanEvent,
  options?: { mandateAbandoned?: boolean; isCancelStep?: boolean; plan?: MfSipPlan; compact?: boolean },
): SipPlanJourneyDisplayStep {
  const mandateAbandoned = options?.mandateAbandoned ?? false;
  const isCancelStep = options?.isCancelStep ?? false;
  let description = describePayload(event.payload, {
    mandateAbandoned,
    plan: options?.plan,
    compact: options?.compact,
  });

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
    toStatus: providerStatusLabel(event) ?? titleCaseStatus(event.to_status),
    isTerminal: isTerminalStatus(event.to_status),
  };
}

function pickCompactJourneyEvents(plan: MfSipPlan, events: MfSipPlanEvent[]): MfSipPlanEvent[] {
  if (events.length === 0) return [];

  const first = events[0];
  const planStatus = plan.status?.toUpperCase() ?? "";

  if (planStatus === "FAILED" || planStatus === "CANCELLED") {
    const terminal = [...events]
      .reverse()
      .find((event) => {
        const status = event.to_status?.toLowerCase();
        return status === "failed" || status === "cancelled";
      });
    return terminal && terminal !== first ? [first, terminal] : [first];
  }

  const activeEvent = [...events].reverse().find(
    (event) =>
      event.to_status?.toLowerCase() === "active" ||
      payloadString(event.payload?.fp_state)?.toLowerCase() === "active",
  );

  const selected: MfSipPlanEvent[] = [first];

  const awaitingMandate =
    planStatus === "CONSENT_PENDING" ||
    plan.next_action === "authorize_mandate" ||
    plan.next_action === "authorize_mandate_switch";

  if (awaitingMandate) {
    const consentEvent = events.find((event) => event.to_status?.toLowerCase() === "consent_pending");
    if (consentEvent && consentEvent !== first) {
      selected.push(consentEvent);
    }
    return selected;
  }

  if (activeEvent && activeEvent !== first) {
    selected.push(activeEvent);
  } else if (!activeEvent && events.length > 1) {
    selected.push(events[events.length - 1]!);
  }

  return selected;
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

function describeFirstInstallment(plan: MfSipPlan) {
  const first = plan.first_installment;
  if (!first || first.status === "not_applicable") return null;

  if (first.status === "paid") {
    return {
      title: "First installment paid",
      description: "Your first SIP payment was received. Monthly installments will run automatically on your SIP date.",
      toStatus: "Paid",
      isTerminal: false,
      isSuccess: true,
    };
  }

  if (first.status === "failed") {
    return {
      title: "First installment failed",
      description: "The first installment payment could not be completed.",
      toStatus: "Failed",
      isTerminal: true,
      isSuccess: false,
    };
  }

  return {
    title: "First installment due",
    description: "Pay the first installment to complete SIP setup.",
    toStatus: "Due",
    isTerminal: false,
    isSuccess: false,
  };
}

function appendFirstInstallmentStep(
  plan: MfSipPlan,
  steps: SipPlanJourneyDisplayStep[],
): SipPlanJourneyDisplayStep[] {
  const copy = describeFirstInstallment(plan);
  if (!copy) return steps;

  const step: SipPlanJourneyDisplayStep = {
    event: {
      from_status: plan.status,
      to_status: plan.first_installment?.status === "paid" ? "paid" : "pending",
      source: "CYBRILLA",
      payload: null,
      created_at: plan.created_at ?? null,
    },
    title: copy.title,
    description: copy.description,
    actor: "Cybrilla",
    toStatus: copy.toStatus,
    isTerminal: copy.isTerminal,
    isSuccess: copy.isSuccess,
  };

  const last = steps[steps.length - 1];
  if (
    last &&
    last.title === step.title &&
    last.description === step.description &&
    last.toStatus === step.toStatus
  ) {
    return steps;
  }
  return [...steps, step];
}

export function buildSipPlanJourneyView(plan: MfSipPlan, events: MfSipPlanEvent[]): SipPlanJourneyView {
  const mandateAbandoned = isMandateAbandoned(plan, events);
  const displayEvents = mandateAbandoned
    ? pickAbandonedJourneyEvents(events)
    : pickCompactJourneyEvents(plan, events);

  const steps = displayEvents.map((event, index) =>
    toDisplayStep(event, {
      mandateAbandoned,
      plan,
      compact: !mandateAbandoned,
      isCancelStep:
        mandateAbandoned &&
        event.to_status === "cancelled" &&
        index === displayEvents.length - 1,
    }),
  );

  return { steps: appendFirstInstallmentStep(plan, steps) };
}
