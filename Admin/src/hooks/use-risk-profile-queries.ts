"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  fetchLockedRiskProfiles,
  fetchRiskAuditLogs,
  fetchRiskCategories,
  fetchRiskQuestions,
  fetchRiskTemplates,
  fetchRiskTiers,
  fetchUserRiskProfiles,
  type LockedRiskProfileUser,
  type RiskAuditLogItem,
  type RiskCategory,
  type RiskQuestion,
  type RiskTemplate,
  type UserRiskProfileItem,
} from "@/lib/risk-profile-admin-api";

export const RISK_CATEGORIES_QUERY_KEY = ["risk-profile-categories"] as const;
export const RISK_QUESTIONS_PANEL_QUERY_KEY = ["risk-profile-questions-panel"] as const;
export const RISK_TEMPLATES_PANEL_QUERY_KEY = ["risk-profile-templates-panel"] as const;
export const RISK_TIERS_QUERY_KEY = ["risk-profile-tiers"] as const;

export function riskCategoriesQueryKey(includeInactive = true) {
  return [...RISK_CATEGORIES_QUERY_KEY, { includeInactive }] as const;
}

export function useRiskCategoriesQuery(includeInactive = true) {
  return useQuery({
    queryKey: riskCategoriesQueryKey(includeInactive),
    queryFn: () => fetchRiskCategories(includeInactive),
    placeholderData: keepPreviousData,
  });
}

export type RiskQuestionsPanelData = {
  categories: RiskCategory[];
  questions: RiskQuestion[];
};

export function useRiskQuestionsPanelQuery() {
  return useQuery({
    queryKey: RISK_QUESTIONS_PANEL_QUERY_KEY,
    queryFn: async (): Promise<RiskQuestionsPanelData> => {
      const [categories, questions] = await Promise.all([
        fetchRiskCategories(true),
        fetchRiskQuestions({ includeInactive: true }),
      ]);
      return { categories, questions };
    },
    placeholderData: keepPreviousData,
  });
}

export type RiskTemplatesPanelData = {
  templates: RiskTemplate[];
  categories: RiskCategory[];
};

export function useRiskTemplatesPanelQuery() {
  return useQuery({
    queryKey: RISK_TEMPLATES_PANEL_QUERY_KEY,
    queryFn: async (): Promise<RiskTemplatesPanelData> => {
      const [templates, categories] = await Promise.all([
        fetchRiskTemplates(true),
        fetchRiskCategories(true),
      ]);
      return {
        templates,
        categories: categories.filter((category) => category.is_active),
      };
    },
    placeholderData: keepPreviousData,
  });
}

export function useRiskTiersQuery() {
  return useQuery({
    queryKey: RISK_TIERS_QUERY_KEY,
    queryFn: fetchRiskTiers,
    placeholderData: keepPreviousData,
  });
}

export type RiskProfileUsersQueryParams = {
  tier?: string;
  limit: number;
  offset: number;
};

export function riskProfileUsersQueryKey(params: RiskProfileUsersQueryParams) {
  return [
    "risk-profile-users",
    {
      tier: params.tier ?? null,
      limit: params.limit,
      offset: params.offset,
    },
  ] as const;
}

export function useRiskProfileUsersQuery(params: RiskProfileUsersQueryParams) {
  return useQuery({
    queryKey: riskProfileUsersQueryKey(params),
    queryFn: async (): Promise<{ items: UserRiskProfileItem[]; hasMore: boolean }> => {
      const result = await fetchUserRiskProfiles({
        tier: params.tier,
        limit: params.limit,
        offset: params.offset,
      });
      return {
        items: result.items,
        hasMore: result.items.length === params.limit,
      };
    },
    placeholderData: keepPreviousData,
  });
}

export type LockedRiskProfilesQueryParams = {
  limit: number;
  offset: number;
};

export function lockedRiskProfilesQueryKey(params: LockedRiskProfilesQueryParams) {
  return [
    "risk-profile-locked-users",
    { limit: params.limit, offset: params.offset },
  ] as const;
}

export function useLockedRiskProfilesQuery(params: LockedRiskProfilesQueryParams) {
  return useQuery({
    queryKey: lockedRiskProfilesQueryKey(params),
    queryFn: async (): Promise<{ items: LockedRiskProfileUser[]; hasMore: boolean }> => {
      const result = await fetchLockedRiskProfiles({
        limit: params.limit,
        offset: params.offset,
      });
      return {
        items: result.items,
        hasMore: result.items.length === params.limit,
      };
    },
    placeholderData: keepPreviousData,
  });
}

export type RiskAuditLogsQueryParams = {
  eventType?: string;
  limit: number;
  offset: number;
};

export function riskAuditLogsQueryKey(params: RiskAuditLogsQueryParams) {
  return [
    "risk-profile-audit-logs",
    {
      eventType: params.eventType ?? null,
      limit: params.limit,
      offset: params.offset,
    },
  ] as const;
}

export function useRiskAuditLogsQuery(params: RiskAuditLogsQueryParams) {
  return useQuery({
    queryKey: riskAuditLogsQueryKey(params),
    queryFn: async (): Promise<{ items: RiskAuditLogItem[]; hasMore: boolean }> => {
      const result = await fetchRiskAuditLogs({
        event_type: params.eventType,
        limit: params.limit,
        offset: params.offset,
      });
      return {
        items: result.items,
        hasMore: result.items.length === params.limit,
      };
    },
    placeholderData: keepPreviousData,
  });
}
