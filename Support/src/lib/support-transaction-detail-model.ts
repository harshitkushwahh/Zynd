import type { DistributorOrder, OrderStatus } from "@/lib/distributor-types";
import { SUPPORT_DUMMY_INVESTORS } from "@/lib/support-users-dummy-data";

export type SupportTransactionJourneyStep = {
  id: string;
  title: string;
  toStatus: string;
  description?: string;
  timestamp: string;
  actor: string;
  isTerminal?: boolean;
};

export type SupportTransactionDetail = {
  order: DistributorOrder;
  displayName: string;
  emailMasked: string;
  profileImageUrl?: string | null;
  amcName: string;
  fpPurchaseId: string;
  checkoutId: string;
  providerStatusLabel: string;
  paymentMethod: string;
  providerState: string;
  nextAction: string;
  productId: string;
  submittedAt?: string;
  settledAt?: string;
  paymentUrl?: string;
  failureMessage?: string;
  outcomeSummary?: string;
  journeySteps: SupportTransactionJourneyStep[];
};

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

function inferAmcName(schemeName: string, existing?: string | null): string {
  if (existing?.trim()) return existing.trim();
  const first = schemeName.split(/\s+/)[0] ?? "AMC";
  return first;
}

function providerStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "Completed":
      return "Settled with AMC";
    case "Failed":
      return "Payment failed";
    case "Processing":
      return "Awaiting allotment";
    case "Pending":
      return "Awaiting payment";
    default:
      return status;
  }
}

function fpStateForStatus(status: OrderStatus): string {
  switch (status) {
    case "Completed":
      return "SETTLED";
    case "Failed":
      return "PAYMENT_FAILED";
    case "Processing":
      return "SUBMITTED";
    case "Pending":
      return "CREATED";
    default:
      return "UNKNOWN";
  }
}

function nextActionForStatus(status: OrderStatus): string {
  switch (status) {
    case "Completed":
      return "none";
    case "Failed":
      return "retry_payment";
    case "Processing":
      return "wait_for_allotment";
    case "Pending":
      return "complete_payment";
    default:
      return "none";
  }
}

function paymentMethodFor(order: DistributorOrder): string {
  if (order.operationChannel === "sip") return "upi_mandate";
  if (order.orderType === "Redeem") return "bank_payout";
  return "net_banking";
}

function buildJourney(order: DistributorOrder): {
  steps: SupportTransactionJourneyStep[];
  outcomeSummary?: string;
  submittedAt?: string;
  settledAt?: string;
  failureMessage?: string;
} {
  const created = order.createdAt;
  const baseSteps: Omit<SupportTransactionJourneyStep, "id">[] = [
    {
      title: "Order placed",
      toStatus: "pending",
      description: `${order.orderType} request recorded on Zynd.`,
      timestamp: created,
      actor: "Investor",
    },
  ];

  if (order.status === "Pending") {
    return {
      steps: baseSteps.map((step, index) => ({ ...step, id: `${order.id}-step-${index}` })),
      outcomeSummary: "Waiting for the investor to complete payment.",
    };
  }

  const paymentAt = addMinutes(created, 8);
  baseSteps.push({
    title: "Payment initiated",
    toStatus: "payment_pending",
    description: "Checkout session opened with the payment provider.",
    timestamp: paymentAt,
    actor: "System",
  });

  if (order.status === "Processing") {
    const submittedAt = addMinutes(created, 22);
    baseSteps.push({
      title: "Payment confirmed",
      toStatus: "submitted",
      description: "Funds received; order forwarded to the registrar.",
      timestamp: submittedAt,
      actor: "Payment gateway",
    });
    baseSteps.push({
      title: "Submitted to AMC",
      toStatus: "processing",
      description: "AMC is processing units for this transaction.",
      timestamp: addMinutes(submittedAt, 15),
      actor: "Registrar",
    });
    return {
      steps: baseSteps.map((step, index) => ({ ...step, id: `${order.id}-step-${index}` })),
      submittedAt,
      outcomeSummary: "Payment is complete. Allotment is in progress with the fund house.",
    };
  }

  if (order.status === "Failed") {
    const failedAt = addMinutes(created, 14);
    baseSteps.push({
      title: "Payment failed",
      toStatus: "failed",
      description: "The provider could not debit the linked account.",
      timestamp: failedAt,
      actor: "Payment gateway",
      isTerminal: true,
    });
    return {
      steps: baseSteps.map((step, index) => ({ ...step, id: `${order.id}-step-${index}` })),
      failureMessage:
        order.orderType === "Redeem"
          ? "Redemption could not be submitted because bank verification did not pass."
          : "Payment was declined by the bank. Ask the investor to retry with another method.",
      outcomeSummary: "This order stopped at payment. No units were allotted.",
    };
  }

  const submittedAt = addMinutes(created, 20);
  const allottedAt = addHours(created, 1);
  const settledAt = addHours(created, 26);

  baseSteps.push(
    {
      title: "Payment confirmed",
      toStatus: "submitted",
      description: "Funds received; order forwarded to the registrar.",
      timestamp: submittedAt,
      actor: "Payment gateway",
    },
    {
      title: "Units allotted",
      toStatus: "processing",
      description: "AMC confirmed allotment for this order.",
      timestamp: allottedAt,
      actor: "Registrar",
    },
    {
      title: "Settlement complete",
      toStatus: "succeeded",
      description: "Units are reflected in the investor folio.",
      timestamp: settledAt,
      actor: "System",
    },
  );

  return {
    steps: baseSteps.map((step, index) => ({ ...step, id: `${order.id}-step-${index}` })),
    submittedAt,
    settledAt,
    outcomeSummary:
      order.orderType === "Redeem"
        ? "Proceeds were sent to the registered bank account."
        : "Investment units are active in the investor folio.",
  };
}

export function buildSupportTransactionDetail(order: DistributorOrder): SupportTransactionDetail {
  const investor = SUPPORT_DUMMY_INVESTORS.find((row) => row.clientCode === order.clientCode);
  const journey = buildJourney(order);
  const amcName = inferAmcName(order.schemeName, order.amcName);

  return {
    order: { ...order, amcName },
    displayName: investor?.displayName ?? order.clientCode,
    emailMasked: investor?.emailMasked ?? order.investorEmailMasked,
    profileImageUrl: investor?.profileImageUrl,
    amcName,
    fpPurchaseId: `fp_pur_${order.id.replace("ord-", "")}`,
    checkoutId: `chk_${order.orderRef.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    providerStatusLabel: providerStatusLabel(order.status),
    paymentMethod: paymentMethodFor(order),
    providerState: fpStateForStatus(order.status),
    nextAction: nextActionForStatus(order.status),
    productId: `ISIN${order.id.replace("ord-", "").padStart(8, "0")}`,
    submittedAt: journey.submittedAt,
    settledAt: journey.settledAt,
    paymentUrl: order.status === "Pending" ? "https://pay.zynd.example/checkout/demo" : undefined,
    failureMessage: journey.failureMessage,
    outcomeSummary: journey.outcomeSummary,
    journeySteps: journey.steps,
  };
}

export function formatSupportTransactionStatus(status: OrderStatus): string {
  switch (status) {
    case "Completed":
      return "Succeeded";
    case "Failed":
      return "Failed";
    case "Processing":
      return "Processing";
    case "Pending":
      return "Pending";
    default:
      return status;
  }
}

export function formatSupportFriendlyToken(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
