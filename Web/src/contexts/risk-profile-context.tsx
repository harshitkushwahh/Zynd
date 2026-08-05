"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import {
  discardRiskProfileDraft,
  type RiskProfileAttemptState,
  type RiskProfileAssessmentHistoryItem,
  type RiskProfileConfig,
  type RiskProfileCurrent,
  type RiskProfileDraft,
  type RiskProfileResult,
  type RiskProfileTierConfig,
} from "@/features/risk-profile/api/risk-profile-api";
import {
  DEFAULT_CONFIG,
  RISK_GAUGE_SUB_ARCS,
  useRiskProfileConfigQuery,
  useRiskProfileHistoryQuery,
  useRiskProfileResultQuery,
  useRiskProfileSessionQuery,
  useRiskProfileTiersQuery,
} from "@/features/risk-profile/hooks/use-risk-profile-data-queries";
import { invalidateRiskProfileQueries } from "@/features/risk-profile/lib/invalidate-risk-profile-queries";
import {
  buildGaugeSubArcsFromTiers,
} from "@/features/risk-profile/lib/risk-tier-ui";
import {
  clearRiskAssessmentDraft,
  hasRiskAssessmentDraftProgress,
  loadRiskAssessmentDraft,
  type RiskAssessmentDraft,
} from "@/features/risk-profile/lib/risk-assessment-draft";
import { getRiskProfileErrorMessage } from "@/features/risk-profile/lib/risk-profile-error";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

type RiskProfileContextValue = {
  profile: RiskProfileCurrent | null;
  assessmentHistory: RiskProfileAssessmentHistoryItem[];
  tiers: RiskProfileTierConfig[];
  config: RiskProfileConfig;
  gaugeSubArcs: typeof RISK_GAUGE_SUB_ARCS;
  attemptState: RiskProfileAttemptState | null;
  serverDraft: RiskProfileDraft | null;
  loading: boolean;
  error: string | null;
  hasProfile: boolean;
  isLocked: boolean;
  assessmentInProgress: boolean;
  assessmentDraftProgress: { current: number; total: number } | null;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
  retryLoad: () => Promise<void>;
  syncLocalDraft: () => void;
  applyResult: (result: RiskProfileCurrent) => void;
  presentCompletedAssessment: (result: RiskProfileResult) => void;
  dismissCompletedAssessmentDialog: () => void;
  completedAssessmentResult: RiskProfileResult | null;
  showCompletedAssessmentDialog: boolean;
  navbarCompletionPulse: boolean;
  clearAssessmentDraft: () => Promise<void>;
};

const RiskProfileContext = createContext<RiskProfileContextValue | null>(null);

function hasDraftProgress(draft: RiskProfileDraft | RiskAssessmentDraft | null) {
  if (!draft) return false;
  if ("step_index" in draft) {
    return draft.step_index > 0 || Object.keys(draft.answers).length > 0;
  }
  return hasRiskAssessmentDraftProgress(draft);
}

function getAssessmentDraftProgress(
  serverDraft: RiskProfileDraft | null,
  localDraft: RiskAssessmentDraft | null,
): { current: number; total: number } | null {
  const activeDraft = hasDraftProgress(serverDraft)
    ? serverDraft
    : hasDraftProgress(localDraft)
      ? localDraft
      : null;

  if (!activeDraft) return null;

  if ("step_index" in activeDraft) {
    const total = activeDraft.question_ids.length;
    if (total <= 0) return null;
    return { current: activeDraft.step_index + 1, total };
  }

  const total = activeDraft.questionIds.length;
  if (total <= 0) return null;
  return { current: activeDraft.stepIndex + 1, total };
}

export function RiskProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const enabled = Boolean(user);

  const resultQuery = useRiskProfileResultQuery(enabled);
  const historyQuery = useRiskProfileHistoryQuery(enabled);
  const sessionQuery = useRiskProfileSessionQuery(enabled);
  const tiersQuery = useRiskProfileTiersQuery(enabled);
  const configQuery = useRiskProfileConfigQuery(enabled);

  const [localDraft, setLocalDraft] = useState<RiskAssessmentDraft | null>(null);
  const [completedAssessmentResult, setCompletedAssessmentResult] = useState<RiskProfileResult | null>(null);
  const [showCompletedAssessmentDialog, setShowCompletedAssessmentDialog] = useState(false);
  const [navbarCompletionPulse, setNavbarCompletionPulse] = useState(false);

  const profile = resultQuery.data ?? null;
  const assessmentHistory = historyQuery.data ?? [];
  const tiers = tiersQuery.data?.items ?? [];
  const config = configQuery.data ?? DEFAULT_CONFIG;
  const sessionAttemptState = sessionQuery.data?.attempt_state ?? null;
  const serverDraft = sessionQuery.data?.draft ?? null;
  const attemptState = profile?.attempt_state ?? sessionAttemptState;

  const loading = enabled && !resultQuery.isFetched;

  const error = resultQuery.isError
    ? getRiskProfileErrorMessage(resultQuery.error, copy.riskProfile.errors.loadFailed)
    : null;

  const refreshLocalDraft = useCallback(() => {
    if (!user?.id) {
      setLocalDraft(null);
      return;
    }
    setLocalDraft(loadRiskAssessmentDraft(user.id));
  }, [user?.id]);

  useEffect(() => {
    refreshLocalDraft();
  }, [refreshLocalDraft]);

  const refreshSession = useCallback(async () => {
    if (!enabled) {
      queryClient.removeQueries({ queryKey: queryKeys.risk.session() });
      return;
    }
    await sessionQuery.refetch();
    refreshLocalDraft();
  }, [enabled, queryClient, refreshLocalDraft, sessionQuery]);

  const refreshProfile = useCallback(async () => {
    if (!enabled) {
      queryClient.removeQueries({ queryKey: queryKeys.risk.all() });
      return;
    }
    await Promise.all([resultQuery.refetch(), historyQuery.refetch()]);
  }, [enabled, historyQuery, queryClient, resultQuery]);

  const retryLoad = useCallback(async () => {
    await invalidateRiskProfileQueries(queryClient);
    await Promise.all([
      resultQuery.refetch(),
      historyQuery.refetch(),
      sessionQuery.refetch(),
      tiersQuery.refetch(),
      configQuery.refetch(),
    ]);
    refreshLocalDraft();
  }, [
    configQuery,
    historyQuery,
    queryClient,
    refreshLocalDraft,
    resultQuery,
    sessionQuery,
    tiersQuery,
  ]);

  const gaugeSubArcs = useMemo(
    () => (tiers.length > 0 ? buildGaugeSubArcsFromTiers(tiers) : RISK_GAUGE_SUB_ARCS),
    [tiers],
  );

  const clearAssessmentDraft = useCallback(async () => {
    if (user?.id) {
      clearRiskAssessmentDraft(user.id);
    }
    setLocalDraft(null);
    try {
      await discardRiskProfileDraft();
    } catch {
      // Best-effort; session refresh reconciles state.
    }
    await refreshSession();
  }, [refreshSession, user?.id]);

  const applyResult = useCallback(
    (result: RiskProfileCurrent) => {
      queryClient.setQueryData(queryKeys.risk.result(), result);
      void historyQuery.refetch();
    },
    [historyQuery, queryClient],
  );

  const presentCompletedAssessment = useCallback((result: RiskProfileResult) => {
    setCompletedAssessmentResult(result);
    setShowCompletedAssessmentDialog(true);
    setNavbarCompletionPulse(true);
  }, []);

  useEffect(() => {
    if (!navbarCompletionPulse) return;
    const timer = window.setTimeout(() => setNavbarCompletionPulse(false), 2800);
    return () => window.clearTimeout(timer);
  }, [navbarCompletionPulse]);

  const dismissCompletedAssessmentDialog = useCallback(() => {
    setShowCompletedAssessmentDialog(false);
    setCompletedAssessmentResult(null);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      assessmentHistory,
      tiers,
      config,
      gaugeSubArcs,
      attemptState,
      serverDraft,
      loading,
      error,
      hasProfile: Boolean(profile),
      isLocked: Boolean(attemptState?.is_locked),
      assessmentInProgress: hasDraftProgress(serverDraft) || hasDraftProgress(localDraft),
      assessmentDraftProgress: getAssessmentDraftProgress(serverDraft, localDraft),
      refreshProfile,
      refreshSession,
      retryLoad,
      syncLocalDraft: refreshLocalDraft,
      applyResult,
      presentCompletedAssessment,
      dismissCompletedAssessmentDialog,
      completedAssessmentResult,
      showCompletedAssessmentDialog,
      navbarCompletionPulse,
      clearAssessmentDraft,
    }),
    [
      profile,
      assessmentHistory,
      tiers,
      config,
      gaugeSubArcs,
      attemptState,
      serverDraft,
      loading,
      error,
      localDraft,
      refreshProfile,
      refreshSession,
      retryLoad,
      refreshLocalDraft,
      applyResult,
      presentCompletedAssessment,
      dismissCompletedAssessmentDialog,
      completedAssessmentResult,
      showCompletedAssessmentDialog,
      navbarCompletionPulse,
      clearAssessmentDraft,
    ],
  );

  return <RiskProfileContext.Provider value={value}>{children}</RiskProfileContext.Provider>;
}

export function useRiskProfile() {
  const context = useContext(RiskProfileContext);
  if (!context) {
    throw new Error("useRiskProfile must be used within RiskProfileProvider");
  }
  return context;
}

export function useRiskProfileOptional() {
  return useContext(RiskProfileContext);
}
