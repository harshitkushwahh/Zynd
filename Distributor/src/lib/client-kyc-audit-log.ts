import type {
  DistributorClientKycAuditEntry,
  DistributorClientKycStep,
  DistributorInvestor,
} from "@/lib/distributor-types";

export type { DistributorClientKycAuditEntry } from "@/lib/distributor-types";

function hashOffset(seed: string, index: number): number {
  let hash = index;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function bumpTimestamp(baseMs: number, investorId: string, index: number, hoursMin: number, hoursMax: number): number {
  const span = Math.max(1, hoursMax - hoursMin);
  const offsetHours = hoursMin + (hashOffset(`${investorId}-${index}`, index) % span);
  const jitterMs = hashOffset(investorId, index + 17) % (45 * 60 * 1000);
  return baseMs + offsetHours * 3600000 + jitterMs;
}

export function buildKycAuditLogForClient(
  investor: DistributorInvestor,
  steps: DistributorClientKycStep[],
  kycInitiatedAt: string,
): DistributorClientKycAuditEntry[] {
  const entries: DistributorClientKycAuditEntry[] = [];
  const startMs = new Date(kycInitiatedAt).getTime();
  let eventIndex = 0;

  const push = (entry: Omit<DistributorClientKycAuditEntry, "id" | "occurredAt"> & { hoursFromStart: number }) => {
    const occurredAt = new Date(
      bumpTimestamp(startMs, investor.id, eventIndex, entry.hoursFromStart, entry.hoursFromStart + 2),
    ).toISOString();
    entries.push({
      id: `${investor.id}-kyc-audit-${eventIndex}`,
      occurredAt,
      action: entry.action,
      stepLabel: entry.stepLabel,
      detail: entry.detail,
      actor: entry.actor,
      source: entry.source,
    });
    eventIndex += 1;
  };

  push({
    hoursFromStart: 0,
    action: "Journey started",
    stepLabel: null,
    detail: "Investor started KYC verification on Zynd.",
    actor: "investor",
    source: "Mobile app",
  });

  let hoursCursor = 2;
  for (const step of steps) {
    if (step.status === "not_applicable") {
      push({
        hoursFromStart: hoursCursor,
        action: "Step skipped",
        stepLabel: step.label,
        detail: "Skipped for KRA-compliant investor — not required on this path.",
        actor: "system",
        source: "System",
      });
      hoursCursor += 1;
      continue;
    }

    push({
      hoursFromStart: hoursCursor,
      action: "Step opened",
      stepLabel: step.label,
      detail: `Investor viewed the ${step.label} step.`,
      actor: "investor",
      source: hashOffset(investor.id, hoursCursor) % 2 === 0 ? "Web app" : "Mobile app",
    });
    hoursCursor += 2;

    if (step.status === "completed") {
      push({
        hoursFromStart: hoursCursor,
        action: "Step completed",
        stepLabel: step.label,
        detail: `${step.label} submitted and saved successfully.`,
        actor: "investor",
        source: hashOffset(investor.id, hoursCursor) % 2 === 0 ? "Mobile app" : "Web app",
      });
      hoursCursor += 3;
      continue;
    }

    if (step.status === "failed") {
      push({
        hoursFromStart: hoursCursor,
        action: "Step needs attention",
        stepLabel: step.label,
        detail: `Validation failed on ${step.label}. Investor must retry.`,
        actor: "system",
        source: "System",
      });
      hoursCursor += 4;
      break;
    }

    if (step.status === "pending") {
      break;
    }
  }

  const reviewStep = steps.find((step) => step.id === "review");
  if (reviewStep?.status === "completed" && investor.onboardingStatus === "Onboarded") {
    push({
      hoursFromStart: hoursCursor + 2,
      action: "KYC submitted",
      stepLabel: "Review",
      detail: "Investor submitted KYC for final review.",
      actor: "investor",
      source: "Mobile app",
    });
    push({
      hoursFromStart: hoursCursor + 8,
      action: "KYC approved",
      stepLabel: "Review",
      detail: "KYC marked complete. Investor is onboarded.",
      actor: "system",
      source: "System",
    });
  }

  return entries.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}
