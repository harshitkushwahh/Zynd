"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRecommendationBasket,
  deleteRecommendationBasket,
  fetchRecommendationBasket,
  fetchRecommendationBaskets,
  fetchRecommendationConfig,
  fetchRecommendationMetrics,
  fetchRecommendationPublishReadiness,
  previewRecommendationSelection,
  publishRecommendationConfig,
  replaceRecommendationBasketFunds,
  updateRecommendationBasket,
  type RecommendationBasketDetail,
  type RecommendationPreview,
  type RiskTierId,
} from "@/lib/recommendations-admin-api";

export const RECOMMENDATION_CONFIG_QUERY_KEY = ["recommendation-config"] as const;
export const RECOMMENDATION_PUBLISH_READINESS_QUERY_KEY = ["recommendation-publish-readiness"] as const;
export const RECOMMENDATION_METRICS_QUERY_KEY = ["recommendation-metrics"] as const;

export function recommendationBasketsQueryKey(tier: RiskTierId) {
  return ["recommendation-baskets", tier] as const;
}

export function recommendationBasketDetailQueryKey(basketId: string | null) {
  return ["recommendation-basket", basketId] as const;
}

export function useRecommendationConfigQuery() {
  return useQuery({
    queryKey: RECOMMENDATION_CONFIG_QUERY_KEY,
    queryFn: fetchRecommendationConfig,
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useRecommendationPublishReadinessQuery() {
  return useQuery({
    queryKey: RECOMMENDATION_PUBLISH_READINESS_QUERY_KEY,
    queryFn: fetchRecommendationPublishReadiness,
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useRecommendationMetricsQuery(enabled = true) {
  return useQuery({
    queryKey: RECOMMENDATION_METRICS_QUERY_KEY,
    queryFn: fetchRecommendationMetrics,
    enabled,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useRecommendationBasketsQuery(tier: RiskTierId) {
  return useQuery({
    queryKey: recommendationBasketsQueryKey(tier),
    queryFn: async () => {
      const result = await fetchRecommendationBaskets(tier);
      return result.items;
    },
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useRecommendationBasketDetailQuery(basketId: string | null) {
  return useQuery({
    queryKey: recommendationBasketDetailQueryKey(basketId),
    queryFn: () => fetchRecommendationBasket(basketId!),
    enabled: Boolean(basketId),
    placeholderData: keepPreviousData,
  });
}

export function useRecommendationPreviewQuery(params: {
  tier: RiskTierId;
  sampleUserId: string;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: ["recommendation-preview", params.tier, params.sampleUserId] as const,
    queryFn: (): Promise<RecommendationPreview> =>
      previewRecommendationSelection({
        tier: params.tier,
        sample_user_id: params.sampleUserId,
      }),
    enabled: params.enabled && params.sampleUserId.trim().length > 0,
  });
}

export function useRecommendationMutations(tier: RiskTierId) {
  const queryClient = useQueryClient();

  const invalidateTier = async (basketId?: string | null) => {
    await queryClient.invalidateQueries({ queryKey: recommendationBasketsQueryKey(tier) });
    await queryClient.invalidateQueries({ queryKey: RECOMMENDATION_PUBLISH_READINESS_QUERY_KEY });
    if (basketId) {
      await queryClient.invalidateQueries({ queryKey: recommendationBasketDetailQueryKey(basketId) });
    }
  };

  const createBasket = useMutation({
    mutationFn: createRecommendationBasket,
    onSuccess: async (basket) => {
      await invalidateTier(basket.id);
    },
  });

  const updateBasket = useMutation({
    mutationFn: ({
      basketId,
      payload,
    }: {
      basketId: string;
      payload: Parameters<typeof updateRecommendationBasket>[1];
    }) => updateRecommendationBasket(basketId, payload),
    onSuccess: async (basket) => {
      await invalidateTier(basket.id);
    },
  });

  const removeBasket = useMutation({
    mutationFn: deleteRecommendationBasket,
    onSuccess: async () => {
      await invalidateTier();
    },
  });

  const replaceFunds = useMutation({
    mutationFn: ({
      basketId,
      funds,
    }: {
      basketId: string;
      funds: Parameters<typeof replaceRecommendationBasketFunds>[1];
    }) => replaceRecommendationBasketFunds(basketId, funds),
    onSuccess: async (basket: RecommendationBasketDetail) => {
      await invalidateTier(basket.id);
    },
  });

  const publishConfig = useMutation({
    mutationFn: publishRecommendationConfig,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: RECOMMENDATION_CONFIG_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: RECOMMENDATION_PUBLISH_READINESS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["platform-audit-logs"] });
      await invalidateTier();
    },
  });

  return {
    createBasket,
    updateBasket,
    removeBasket,
    replaceFunds,
    publishConfig,
    invalidateTier,
  };
}
