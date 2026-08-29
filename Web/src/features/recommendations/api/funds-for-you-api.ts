import { apiRequest } from "@/lib/api-client";

import type { FundsForYouResponse } from "@/features/recommendations/types/funds-for-you";

export async function fetchFundsForYou() {
  return apiRequest<FundsForYouResponse>("/invest/recommendations/funds-for-you");
}
