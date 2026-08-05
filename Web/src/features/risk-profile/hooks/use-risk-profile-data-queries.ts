"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchAllRiskProfileAssessmentHistory,
  fetchRiskProfileConfig,
  fetchRiskProfileResult,
  fetchRiskProfileSession,
  fetchRiskProfileTiers,
  type RiskProfileConfig,
} from "@/features/risk-profile/api/risk-profile-api";
import {
  RISK_GAUGE_SUB_ARCS,
  RISK_PROFILE_TRENDS_MIN_PROFILES,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-client";

const DEFAULT_CONFIG: RiskProfileConfig = {
  trends_min_profiles: RISK_PROFILE_TRENDS_MIN_PROFILES,
  default_attempts: 6,
  unlock_bonus_attempts: 3,
};

export function useRiskProfileResultQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.risk.result(),
    queryFn: async () => {
      try {
        return await fetchRiskProfileResult();
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled,
  });
}

export function useRiskProfileHistoryQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.risk.history(),
    queryFn: fetchAllRiskProfileAssessmentHistory,
    enabled,
  });
}

export function useRiskProfileSessionQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.risk.session(),
    queryFn: fetchRiskProfileSession,
    enabled,
  });
}

export function useRiskProfileTiersQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.risk.tiers(),
    queryFn: () => fetchRiskProfileTiers().catch(() => ({ items: [] })),
    enabled,
  });
}

export function useRiskProfileConfigQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.risk.config(),
    queryFn: () => fetchRiskProfileConfig().catch(() => DEFAULT_CONFIG),
    enabled,
  });
}

export { DEFAULT_CONFIG, RISK_GAUGE_SUB_ARCS };
