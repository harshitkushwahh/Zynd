export type RiskAssessmentDraft = {
  templateId: string | null;
  questionIds: string[];
  stepIndex: number;
  answers: Record<string, string>;
  updatedAt: string;
};

function storageKey(userId: string) {
  return `zynd.risk-profile.assessment-draft.${userId}`;
}

export function loadRiskAssessmentDraft(userId: string): RiskAssessmentDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RiskAssessmentDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.answers) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRiskAssessmentDraft(userId: string, draft: RiskAssessmentDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(draft));
}

export function clearRiskAssessmentDraft(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(userId));
}

export function isRiskAssessmentDraftValid(
  draft: RiskAssessmentDraft | null,
  params: { templateId: string | null; questionIds: string[] },
) {
  if (!draft) return false;
  if (draft.templateId !== params.templateId) return false;
  if (draft.questionIds.length !== params.questionIds.length) return false;
  return draft.questionIds.every((id, index) => id === params.questionIds[index]);
}

export function hasRiskAssessmentDraftProgress(draft: RiskAssessmentDraft | null) {
  if (!draft) return false;
  return draft.stepIndex > 0 || Object.keys(draft.answers).length > 0;
}
