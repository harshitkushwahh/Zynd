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

import { useAuth } from "@/contexts/auth-context";
import {
  discardRiskProfileDraft,
  fetchAllRiskProfileAssessmentHistory,
  fetchRiskProfileConfig,
  fetchRiskProfileResult,
  fetchRiskProfileSession,
  fetchRiskProfileTiers,
  type RiskProfileAttemptState,
  type RiskProfileAssessmentHistoryItem,
  type RiskProfileConfig,
  type RiskProfileCurrent,
  type RiskProfileDraft,
  type RiskProfileResult,
  type RiskProfileTierConfig,
} from "@/features/risk-profile/api/risk-profile-api";
import {
  buildGaugeSubArcsFromTiers,
  RISK_GAUGE_SUB_ARCS,
  RISK_PROFILE_TRENDS_MIN_PROFILES,
} from "@/features/risk-profile/lib/risk-tier-ui";
import {
  clearRiskAssessmentDraft,
  hasRiskAssessmentDraftProgress,
  loadRiskAssessmentDraft,
  type RiskAssessmentDraft,
} from "@/features/risk-profile/lib/risk-assessment-draft";
import { getRiskProfileErrorMessage } from "@/features/risk-profile/lib/risk-profile-error";
import { copy } from "@/shared/config/copy";
import { ApiError } from "@/lib/api-client";

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
  const [profile, setProfile] = useState<RiskProfileCurrent | null>(null);
  const [assessmentHistory, setAssessmentHistory] = useState<RiskProfileAssessmentHistoryItem[]>([]);
  const [tiers, setTiers] = useState<RiskProfileTierConfig[]>([]);
  const [config, setConfig] = useState<RiskProfileConfig>({
    trends_min_profiles: RISK_PROFILE_TRENDS_MIN_PROFILES,
    default_attempts: 6,
    unlock_bonus_attempts: 3,
  });
  const [attemptState, setAttemptState] = useState<RiskProfileAttemptState | null>(null);
  const [serverDraft, setServerDraft] = useState<RiskProfileDraft | null>(null);
  const [localDraft, setLocalDraft] = useState<RiskAssessmentDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedAssessmentResult, setCompletedAssessmentResult] = useState<RiskProfileResult | null>(null);
  const [showCompletedAssessmentDialog, setShowCompletedAssessmentDialog] = useState(false);
  const [navbarCompletionPulse, setNavbarCompletionPulse] = useState(false);

  const refreshLocalDraft = useCallback(() => {
    if (!user?.id) {
      setLocalDraft(null);
      return;
    }
    setLocalDraft(loadRiskAssessmentDraft(user.id));
  }, [user?.id]);

  const refreshSession = useCallback(async () => {
    if (!user) {
      setAttemptState(null);
      setServerDraft(null);
      return;
    }
    try {
      const session = await fetchRiskProfileSession();
      setAttemptState(session.attempt_state);
      setServerDraft(session.draft);
    } catch {
      setAttemptState(null);
      setServerDraft(null);
    }
    refreshLocalDraft();
  }, [refreshLocalDraft, user]);

  const refreshAssessmentHistory = useCallback(async () => {
    if (!user) {
      setAssessmentHistory([]);
      return;
    }
    try {
      const items = await fetchAllRiskProfileAssessmentHistory();
      setAssessmentHistory(items);
    } catch {
      setAssessmentHistory([]);
    }
  }, [user]);

  const gaugeSubArcs = useMemo(
    () =>
      tiers.length > 0
        ? buildGaugeSubArcsFromTiers(tiers)
        : RISK_GAUGE_SUB_ARCS,
    [tiers],
  );

  const refreshReferenceData = useCallback(async () => {
    if (!user) {
      setTiers([]);
      setConfig({
        trends_min_profiles: RISK_PROFILE_TRENDS_MIN_PROFILES,
        default_attempts: 6,
        unlock_bonus_attempts: 3,
      });
      return;
    }

    const [tierResult, configResult] = await Promise.all([
      fetchRiskProfileTiers().catch(() => ({ items: [] as RiskProfileTierConfig[] })),
      fetchRiskProfileConfig().catch(
        (): RiskProfileConfig => ({
          trends_min_profiles: RISK_PROFILE_TRENDS_MIN_PROFILES,
          default_attempts: 6,
          unlock_bonus_attempts: 3,
        }),
      ),
    ]);

    setTiers(tierResult.items);
    setConfig(configResult);
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setAssessmentHistory([]);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const [profileResult, historyItems] = await Promise.all([
        fetchRiskProfileResult().catch((loadError) => {
          if (loadError instanceof ApiError && loadError.status === 404) {
            return null;
          }
          throw loadError;
        }),
        fetchAllRiskProfileAssessmentHistory().catch(() => [] as RiskProfileAssessmentHistoryItem[]),
      ]);
      setProfile(profileResult);
      setAssessmentHistory(historyItems);
      if (profileResult?.attempt_state) {
        setAttemptState(profileResult.attempt_state);
      }
      setError(null);
    } catch (loadError) {
      setProfile(null);
      setAssessmentHistory([]);
      setError(getRiskProfileErrorMessage(loadError, copy.riskProfile.errors.pageLoadFailed));
    } finally {
      setLoading(false);
    }
  }, [user]);

  const retryLoad = useCallback(async () => {
    setError(null);
    await Promise.all([refreshSession(), refreshReferenceData(), refreshProfile()]);
  }, [refreshProfile, refreshReferenceData, refreshSession]);

  useEffect(() => {
    void refreshReferenceData();
  }, [refreshReferenceData]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const clearAssessmentDraft = useCallback(async () => {
    if (user?.id) {
      clearRiskAssessmentDraft(user.id);
    }
    setLocalDraft(null);
    setServerDraft(null);
    try {
      await discardRiskProfileDraft();
    } catch {
      // Best-effort; session refresh reconciles state.
    }
    await refreshSession();
  }, [refreshSession, user?.id]);

  const applyResult = useCallback(
    (result: RiskProfileCurrent) => {
      setProfile(result);
      if (result.attempt_state) {
        setAttemptState(result.attempt_state);
      }
      setError(null);
      void refreshAssessmentHistory();
    },
    [refreshAssessmentHistory],
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
