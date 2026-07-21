"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import {
  discardRiskProfileDraft,
  fetchRiskProfileAssessment,
  fetchRiskProfileSession,
  saveRiskProfileDraft,
  submitRiskProfileAssessment,
  type RiskProfileAssessment,
  type RiskProfileQuestion,
} from "@/features/risk-profile/api/risk-profile-api";
import {
  clearRiskAssessmentDraft,
  isRiskAssessmentDraftValid,
  loadRiskAssessmentDraft,
  saveRiskAssessmentDraft,
} from "@/features/risk-profile/lib/risk-assessment-draft";
import { isAssessmentSessionDiscarded } from "@/features/risk-profile/lib/risk-assessment-session";
import { RISK_PROFILE_HREF } from "@/features/risk-profile/lib/risk-profile-navigation";
import { RiskAssessmentPageSkeleton } from "@/features/risk-profile/components/risk-assessment-page-skeleton";
import { RiskProfileLoadErrorCard } from "@/features/risk-profile/components/risk-profile-load-error-card";
import {
  RiskProfileSessionErrorDialog,
  type RiskProfileSessionErrorKind,
} from "@/features/risk-profile/components/risk-profile-session-error-dialog";
import { RiskAssessmentWhyCard } from "@/features/risk-profile/components/risk-assessment-why-card";
import { RiskAssessmentDurationBadge } from "@/features/risk-profile/components/risk-assessment-duration-badge";
import { RiskAssessmentStepBubbles } from "@/features/risk-profile/components/risk-assessment-step-bubbles";
import { useRiskAssessmentLeaveGuard } from "@/features/risk-profile/hooks/use-risk-assessment-leave-guard";
import { getRiskProfileErrorMessage } from "@/features/risk-profile/lib/risk-profile-error";
import { RISK_PROFILE_CARD_CLASS } from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";

export function RiskAssessmentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const riskProfile = useRiskProfileOptional();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [assessment, setAssessment] = useState<RiskProfileAssessment | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [savingExit, setSavingExit] = useState(false);
  const [blockedReason, setBlockedReason] = useState<RiskProfileSessionErrorKind | null>(null);
  const submitInFlightRef = useRef(false);
  const hadServerDraftRef = useRef(false);
  const stepIndexRef = useRef(stepIndex);
  const answersRef = useRef(answers);

  stepIndexRef.current = stepIndex;
  answersRef.current = answers;

  const invalidateSession = useCallback(
    (reason: RiskProfileSessionErrorKind) => {
      if (user?.id) {
        clearRiskAssessmentDraft(user.id);
      }
      submitInFlightRef.current = false;
      setSubmitting(false);
      setAssessment(null);
      setStepIndex(0);
      setAnswers({});
      setError("");
      setBlockedReason(reason);
    },
    [user?.id],
  );

  const exitToRiskProfile = useCallback(() => {
    setBlockedReason(null);
    router.replace(RISK_PROFILE_HREF);
    router.refresh();
  }, [router]);

  const validateActiveSession = useCallback(
    async (options?: { skipDiscardedCheck?: boolean }): Promise<boolean> => {
      if (blockedReason || submitInFlightRef.current) {
        return false;
      }

      try {
        const session = await fetchRiskProfileSession();
        if (session.attempt_state.is_locked) {
          invalidateSession("locked");
          return false;
        }
        if (
          !options?.skipDiscardedCheck &&
          isAssessmentSessionDiscarded(
            session.draft,
            stepIndexRef.current,
            answersRef.current,
            user?.id,
            hadServerDraftRef.current,
          )
        ) {
          invalidateSession("discarded");
          return false;
        }
        return true;
      } catch {
        return true;
      }
    },
    [blockedReason, invalidateSession, user?.id],
  );

  const questions = assessment?.questions ?? [];
  const activeQuestion: RiskProfileQuestion | null = questions[stepIndex] ?? null;

  const loadAssessment = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await fetchRiskProfileSession();
      if (session.attempt_state.is_locked) {
        invalidateSession("locked");
        return;
      }

      const payload = await fetchRiskProfileAssessment();
      if (!payload.questions.length) {
        setError(copy.riskProfile.errors.noQuestions);
        return;
      }

      const questionIds = payload.questions.map((question) => question.id);
      const templateId = payload.template?.id ?? null;
      const serverDraft = session.draft;
      const storedDraft = user?.id ? loadRiskAssessmentDraft(user.id) : null;
      const validServerDraft =
        serverDraft &&
        serverDraft.template_id === templateId &&
        serverDraft.question_ids.length === questionIds.length &&
        serverDraft.question_ids.every((id, index) => id === questionIds[index])
          ? serverDraft
          : null;
      const validLocalDraft = isRiskAssessmentDraftValid(storedDraft, { templateId, questionIds })
        ? storedDraft
        : null;
      const restoredDraft = validServerDraft ?? validLocalDraft;
      hadServerDraftRef.current = Boolean(validServerDraft);

      setAssessment(payload);
      setStepIndex(
        validServerDraft?.step_index ?? validLocalDraft?.stepIndex ?? 0,
      );
      setAnswers(restoredDraft?.answers ?? {});
    } catch (err) {
      if (err instanceof ApiError && err.code === "risk_profile_locked") {
        invalidateSession("locked");
        return;
      }
      setError(getRiskProfileErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [invalidateSession, user?.id]);

  useEffect(() => {
    void loadAssessment();
  }, [loadAssessment]);

  useEffect(() => {
    if (blockedReason || !assessment || !user?.id) return;
    if (stepIndex === 0 && Object.keys(answers).length === 0) return;

    saveRiskAssessmentDraft(user.id, {
      templateId: assessment.template?.id ?? null,
      questionIds: assessment.questions.map((question) => question.id),
      stepIndex,
      answers,
      updatedAt: new Date().toISOString(),
    });
    riskProfile?.syncLocalDraft();
  }, [answers, assessment, blockedReason, riskProfile?.syncLocalDraft, stepIndex, user?.id]);

  useEffect(() => {
    if (loading || blockedReason || !assessment || submitting || submitInFlightRef.current) return;
    if (
      isAssessmentSessionDiscarded(
        riskProfile?.serverDraft,
        stepIndex,
        answers,
        user?.id,
        hadServerDraftRef.current,
      )
    ) {
      invalidateSession("discarded");
    }
  }, [
    answers,
    assessment,
    blockedReason,
    invalidateSession,
    loading,
    riskProfile?.serverDraft,
    stepIndex,
    submitting,
    user?.id,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!assessment || blockedReason || submitting || submitInFlightRef.current) return;
      void validateActiveSession();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [assessment, blockedReason, submitting, validateActiveSession]);

  const canContinue = activeQuestion ? Boolean(answers[activeQuestion.id]) : false;
  const isLastStep = stepIndex >= questions.length - 1;
  const isSubmitLocked = submitting || submitInFlightRef.current;

  const clearInMemoryAssessment = useCallback(() => {
    hadServerDraftRef.current = false;
    setAssessment(null);
    setStepIndex(0);
    setAnswers({});
  }, []);

  const persistDraft = useCallback(
    async (nextStepIndex: number, nextAnswers: Record<string, string>) => {
      if (!assessment || !user?.id || blockedReason) return;
      const sessionActive = await validateActiveSession();
      if (!sessionActive) return;

      const questionIds = assessment.questions.map((question) => question.id);
      saveRiskAssessmentDraft(user.id, {
        templateId: assessment.template?.id ?? null,
        questionIds,
        stepIndex: nextStepIndex,
        answers: nextAnswers,
        updatedAt: new Date().toISOString(),
      });
      await saveRiskProfileDraft({
        template_id: assessment.template?.id ?? null,
        question_ids: questionIds,
        answers: nextAnswers,
        step_index: nextStepIndex,
      });
      hadServerDraftRef.current = true;
      await riskProfile?.refreshSession();
    },
    [assessment, blockedReason, riskProfile, user?.id, validateActiveSession],
  );

  const hasAssessmentProgress =
    !loading &&
    !blockedReason &&
    Boolean(activeQuestion) &&
    (stepIndex > 0 || Object.keys(answers).length > 0);

  const saveCurrentDraft = useCallback(async () => {
    await persistDraft(stepIndex, answers);
  }, [answers, persistDraft, stepIndex]);

  const { open: leaveDialogOpen, saving: leaving, confirmLeave, cancelLeave } = useRiskAssessmentLeaveGuard({
    enabled: hasAssessmentProgress,
    onSaveAndLeave: saveCurrentDraft,
  });

  const handleDiscardDraft = async () => {
    setDiscarding(true);
    if (user?.id) {
      clearRiskAssessmentDraft(user.id);
    }
    try {
      await discardRiskProfileDraft();
      await riskProfile?.refreshSession();
      hadServerDraftRef.current = false;
      setStepIndex(0);
      setAnswers({});
      setDiscardDialogOpen(false);
      toast.success("Draft discarded.");
    } catch (err) {
      setError(getRiskProfileErrorMessage(err));
    } finally {
      setDiscarding(false);
    }
  };

  const handleSaveAndExit = async () => {
    if (isSubmitLocked || blockedReason) return;

    setSavingExit(true);
    setError("");
    try {
      const sessionActive = await validateActiveSession();
      if (!sessionActive) return;

      await persistDraft(stepIndex, answers);
      router.push(RISK_PROFILE_HREF);
    } catch (err) {
      setError(getRiskProfileErrorMessage(err));
    } finally {
      setSavingExit(false);
    }
  };

  const handleContinue = async () => {
    if (!activeQuestion || !canContinue || !assessment || isSubmitLocked || blockedReason) return;

    const sessionActive = await validateActiveSession({ skipDiscardedCheck: isLastStep });
    if (!sessionActive) {
      return;
    }

    if (!isLastStep) {
      const nextStepIndex = stepIndex + 1;
      const nextAnswers = { ...answers };
      await persistDraft(nextStepIndex, nextAnswers);
      setStepIndex(nextStepIndex);
      return;
    }

    submitInFlightRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      const payload = await submitRiskProfileAssessment({
        template_id: assessment.template?.id,
        answers: questions.map((question) => ({
          question_id: question.id,
          option_id: answers[question.id],
        })),
      });

      if (user?.id) {
        clearRiskAssessmentDraft(user.id);
      }
      clearInMemoryAssessment();
      await discardRiskProfileDraft().catch(() => undefined);
      await riskProfile?.refreshSession();

      if (user) {
        riskProfile?.applyResult({
          user_id: user.id,
          score: payload.score,
          display_score: payload.display_score,
          tier: payload.tier,
          tier_config: payload.tier_config,
          assessment_id: payload.assessment_id,
          questions_answered: questions.length,
          total_questions: questions.length,
          computed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          attempt_state: payload.attempt_state,
        });
      }

      riskProfile?.presentCompletedAssessment(payload);
      void riskProfile?.refreshProfile();
      router.replace(RISK_PROFILE_HREF);
    } catch (err) {
      submitInFlightRef.current = false;
      setSubmitting(false);
      if (err instanceof ApiError && err.code === "risk_profile_locked") {
        invalidateSession("locked");
        return;
      }
      setError(getRiskProfileErrorMessage(err, copy.riskProfile.errors.submitFailed));
    }
  };

  const questionIds = useMemo(() => questions.map((question) => question.id), [questions]);
  const answeredQuestionIds = useMemo(
    () => Object.keys(answers).filter((questionId) => Boolean(answers[questionId])),
    [answers],
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <DashboardBreadcrumb
        className="mb-4"
        items={[
          { label: "Risk Profile", href: RISK_PROFILE_HREF },
          { label: copy.riskProfile.dialogTitle },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <div className="w-full space-y-4">
          {loading ? <RiskAssessmentPageSkeleton /> : null}

          {error && !assessment ? (
            <RiskProfileLoadErrorCard
              title={copy.riskProfile.errors.loadFailedTitle}
              description={error}
              retryLabel={copy.riskProfile.errors.retry}
              retryLoading={loading}
              onRetry={() => void loadAssessment()}
              backAction={
                <Button variant="outline" nativeButton={false} render={<Link href={RISK_PROFILE_HREF} />}>
                  {copy.riskProfile.backAction}
                </Button>
              }
            />
          ) : null}

          {!loading && activeQuestion && !blockedReason ? (
            <>
              <div className={cn(RISK_PROFILE_CARD_CLASS, "relative overflow-hidden p-4")}>
                <div className="relative z-10 mb-4 space-y-2 sm:max-w-[calc(100%-8rem)]">
                  <RiskAssessmentDurationBadge />
                  <h2 className="text-body font-semibold tracking-tight text-foreground sm:text-h4">
                    {copy.riskProfile.assessmentHeaderTitle}
                  </h2>
                  <p className="text-compact leading-relaxed text-muted-foreground">
                    {copy.riskProfile.assessmentHeaderDescription}
                  </p>
                </div>

                <div className="pointer-events-none absolute inset-y-4 right-4 z-0 hidden w-24 sm:block sm:w-28 md:w-32">
                  <Image
                    src="/risk.png"
                    alt=""
                    fill
                    sizes="(min-width: 768px) 128px, 96px"
                    className="object-contain object-bottom object-right mix-blend-multiply dark:mix-blend-screen drop-shadow-lg"
                    priority
                  />
                </div>

                <div className="relative z-10">
                  <RiskAssessmentStepBubbles
                    totalSteps={questions.length}
                    currentStepIndex={stepIndex}
                    answeredQuestionIds={answeredQuestionIds}
                    questionIds={questionIds}
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-stretch xl:grid-cols-[minmax(0,1fr)_19rem]">
                <div className={cn(RISK_PROFILE_CARD_CLASS, "flex h-full flex-col p-4")}>
                  <div className="flex-1 space-y-4">
                    {error ? <FieldMessage message={error} className="mt-0" /> : null}
                    {activeQuestion.category_name ? (
                      <p className="text-caption font-semibold uppercase tracking-wide text-primary">
                        {activeQuestion.category_name}
                      </p>
                    ) : null}
                    <p className="text-body font-semibold leading-snug text-foreground">{activeQuestion.prompt}</p>
                    <div className="flex flex-col gap-2">
                      {activeQuestion.options.map((option) => {
                        const selected = answers[activeQuestion.id] === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border px-3 py-3 text-left text-compact transition-colors",
                              selected
                                ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20"
                                : "border-border bg-background text-foreground hover:border-primary/30 hover:bg-muted/40",
                            )}
                            onClick={() =>
                              setAnswers((current) => ({ ...current, [activeQuestion.id]: option.id }))
                            }
                          >
                            <span className="min-w-0 flex-1">{option.label}</span>
                            <span
                              className={cn(
                                "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/35 bg-transparent",
                              )}
                              aria-hidden
                            >
                              {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={stepIndex === 0 || isSubmitLocked}
                        onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                      >
                        {copy.riskProfile.backAction}
                      </Button>
                      {(stepIndex > 0 || Object.keys(answers).length > 0) && (
                        <>
                          <Button
                            variant="outline"
                            disabled={isSubmitLocked || discarding || savingExit}
                            onClick={() => void handleSaveAndExit()}
                          >
                            {savingExit
                              ? copy.riskProfile.savingExit
                              : copy.riskProfile.saveAndExitAction}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={copy.riskProfile.discardDraftAction}
                            disabled={isSubmitLocked || discarding || savingExit}
                            onClick={() => setDiscardDialogOpen(true)}
                          >
                            <Trash2 className="size-4" strokeWidth={2.25} />
                          </Button>
                        </>
                      )}
                    </div>
                    <Button disabled={!canContinue || isSubmitLocked} onClick={() => void handleContinue()}>
                      {submitting
                        ? copy.riskProfile.submitting
                        : isLastStep
                          ? copy.riskProfile.submitAction
                          : copy.riskProfile.continueAction}
                    </Button>
                  </div>
                </div>

                <RiskAssessmentWhyCard className="h-full" />
              </div>
            </>
          ) : null}

          {!loading && !activeQuestion && !error && !blockedReason ? (
            <div className={cn(RISK_PROFILE_CARD_CLASS, "p-4")}>
              <Button variant="outline" nativeButton={false} render={<Link href={RISK_PROFILE_HREF} />}>
                {copy.riskProfile.backAction}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <RiskProfileSessionErrorDialog
        open={blockedReason !== null}
        kind={blockedReason ?? "locked"}
        onDone={exitToRiskProfile}
      />

      <ConfirmDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        variant="destructive"
        title={copy.riskProfile.discardDraftConfirm.title}
        description={copy.riskProfile.discardDraftConfirm.description}
        confirmLabel={copy.riskProfile.discardDraftConfirm.confirm}
        cancelLabel={copy.riskProfile.discardDraftConfirm.cancel}
        loading={discarding}
        onConfirm={() => void handleDiscardDraft()}
      />

      <ConfirmDialog
        open={leaveDialogOpen}
        onOpenChange={(open) => {
          if (!open) cancelLeave();
        }}
        variant="warning"
        title={copy.riskProfile.leaveAssessmentConfirm.title}
        description={copy.riskProfile.leaveAssessmentConfirm.description}
        confirmLabel={copy.riskProfile.leaveAssessmentConfirm.confirm}
        cancelLabel={copy.riskProfile.leaveAssessmentConfirm.cancel}
        loading={leaving}
        onConfirm={() => void confirmLeave()}
      />
    </div>
  );
}
