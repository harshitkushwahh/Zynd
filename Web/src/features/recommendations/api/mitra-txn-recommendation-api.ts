import { apiRequest } from "@/lib/api-client";

import type {
  ApplyMitraTxnRecommendationResponse,
  MitraTxnRecommendation,
} from "@/features/recommendations/types/mitra-txn-recommendation";

export async function fetchMitraTxnRecommendation(token: string) {
  return apiRequest<MitraTxnRecommendation>(`/invest/txn-recommendations/${encodeURIComponent(token)}`);
}

export async function applyMitraTxnRecommendation(token: string) {
  return apiRequest<ApplyMitraTxnRecommendationResponse>(
    `/invest/txn-recommendations/${encodeURIComponent(token)}/apply`,
    { method: "POST" },
  );
}
