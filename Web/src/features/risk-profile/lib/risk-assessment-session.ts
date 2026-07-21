import type { RiskProfileDraft } from "@/features/risk-profile/api/risk-profile-api";
import { loadRiskAssessmentDraft } from "@/features/risk-profile/lib/risk-assessment-draft";

export function hasInMemoryAssessmentProgress(
  stepIndex: number,
  answers: Record<string, string>,
): boolean {
  return stepIndex > 0 || Object.keys(answers).length > 0;
}

/** True when the user still has in-memory progress but the server draft was destroyed. */
export function isAssessmentSessionDiscarded(
  draft: RiskProfileDraft | null | undefined,
  stepIndex: number,
  answers: Record<string, string>,
  userId: string | undefined,
  hadServerDraft = false,
): boolean {
  if (!hasInMemoryAssessmentProgress(stepIndex, answers)) {
    return false;
  }
  if (draft) {
    return false;
  }

  const localDraft = userId ? loadRiskAssessmentDraft(userId) : null;
  if (localDraft && Object.keys(localDraft.answers).length > 0) {
    return false;
  }

  return hadServerDraft || stepIndex > 0;
}
