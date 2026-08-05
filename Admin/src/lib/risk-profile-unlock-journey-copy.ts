import type { RiskProfileUnlockJourneyStep } from "@/lib/risk-profile-admin-api";

export type UnlockJourneyDisplayStep = RiskProfileUnlockJourneyStep & {
  actor: string;
  badgeVariant: "success" | "destructive" | "warning" | "info" | "neutral";
  isTerminal: boolean;
};

function stepBadgeVariant(kind: RiskProfileUnlockJourneyStep["kind"]) {
  switch (kind) {
    case "granted":
      return "success" as const;
    case "locked":
    case "otp_failed":
      return "destructive" as const;
    case "otp_expired":
      return "warning" as const;
    case "otp_requested":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

function isTerminalStep(kind: RiskProfileUnlockJourneyStep["kind"]) {
  return kind === "locked" || kind === "otp_failed" || kind === "otp_expired";
}

export function buildUnlockJourneyDisplaySteps(steps: RiskProfileUnlockJourneyStep[]) {
  return steps.map((step) => ({
    ...step,
    actor: step.admin_display_name ?? step.admin_email ?? "System",
    badgeVariant: stepBadgeVariant(step.kind),
    isTerminal: isTerminalStep(step.kind),
  })) satisfies UnlockJourneyDisplayStep[];
}
