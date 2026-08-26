import type { KycBootstrapResponse } from "@/features/kyc/lib/kyc-api";
import {
  getKycJourneySteps,
  requiresFullKycSubmission,
  type KycJourneyStepId,
} from "@/features/kyc/lib/kyc-journey";
import { getKycStepFormMeta } from "@/features/kyc/lib/kyc-step-form-meta";
import { copy } from "@/shared/config/copy";

export type OverviewKycProfileProgress = {
  activeStepId: KycJourneyStepId;
  activeStepLabel: string;
  progressFraction: number;
  progressPercent: number;
  tone: "success" | "warning" | "muted";
  overallStatus: string;
  statusLabel: string;
  stepTitle: string;
  tooltipVariant: "verified" | "submitted" | "in_progress" | "not_started";
  tooltipTitle: string;
  tooltipDetail: string;
};

function overallStatusLabel(overall: string): string {
  const overview = copy.dashboard.overview;
  switch (overall) {
    case "completed":
      return overview.profileKycStatusVerified;
    case "submitted":
      return overview.profileKycStatusSubmitted;
    case "phase2_complete":
      return overview.profileKycStatusPhase2;
    case "phase1_complete":
      return overview.profileKycStatusPhase1;
    case "in_progress":
      return overview.profileKycStatusInProgress;
    default:
      return overview.profileKycStatusNotStarted;
  }
}

export function buildOverviewKycProfileProgress(
  payload: KycBootstrapResponse,
): OverviewKycProfileProgress {
  const overview = copy.dashboard.overview;
  const requiresFullKyc = requiresFullKycSubmission({
    kyc_already_registered: payload.kyc_already_registered,
    readiness_code: payload.readiness_code,
  });
  const steps = getKycJourneySteps(requiresFullKyc);
  const totalSteps = Math.max(steps.length, 1);
  const activeIndex = Math.min(Math.max(payload.active_step_index ?? 0, 0), totalSteps - 1);
  const activeStep = steps[activeIndex] ?? steps[0]!;
  const overall = payload.step_statuses?.overall ?? "none";

  if (overall === "completed") {
    return {
      activeStepId: "review",
      activeStepLabel: copy.kyc.completeTitle,
      progressFraction: 1,
      progressPercent: 100,
      tone: "success",
      overallStatus: overall,
      statusLabel: overallStatusLabel(overall),
      stepTitle: copy.kyc.completeTitle,
      tooltipVariant: "verified",
      tooltipTitle: overview.profileKycTooltipCompleteTitle,
      tooltipDetail: overview.profileKycTooltipComplete,
    };
  }

  if (overall === "submitted") {
    return {
      activeStepId: "review",
      activeStepLabel: copy.kyc.submittedTitle,
      progressFraction: 1,
      progressPercent: 100,
      tone: "warning",
      overallStatus: overall,
      statusLabel: overallStatusLabel(overall),
      stepTitle: copy.kyc.submittedTitle,
      tooltipVariant: "submitted",
      tooltipTitle: overview.profileKycTooltipSubmittedTitle,
      tooltipDetail: overview.profileKycTooltipSubmitted,
    };
  }

  const progressFraction = Math.min(Math.max(activeIndex / totalSteps, 0), 1);
  const progressPercent = Math.round(progressFraction * 100);
  const stepMeta = getKycStepFormMeta(activeStep.id);

  if (overall === "none") {
    return {
      activeStepId: activeStep.id,
      activeStepLabel: activeStep.label,
      progressFraction: 0,
      progressPercent: 0,
      tone: "muted",
      overallStatus: overall,
      statusLabel: overallStatusLabel(overall),
      stepTitle: stepMeta.title,
      tooltipVariant: "not_started",
      tooltipTitle: overview.profileKycTooltipPendingTitle,
      tooltipDetail: overview.profileKycTooltipPending,
    };
  }

  return {
    activeStepId: activeStep.id,
    activeStepLabel: activeStep.label,
    progressFraction,
    progressPercent,
    tone: "warning",
    overallStatus: overall,
    statusLabel: overallStatusLabel(overall),
    stepTitle: stepMeta.title,
    tooltipVariant: "in_progress",
    tooltipTitle: overview.profileKycTooltipInProgressTitle,
    tooltipDetail: overview.profileKycTooltipInProgressDetail
      .replace("{step}", stepMeta.title)
      .replace("{progress}", String(progressPercent)),
  };
}
