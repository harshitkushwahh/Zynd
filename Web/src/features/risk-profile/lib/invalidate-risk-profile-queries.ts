import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export function invalidateRiskProfileQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.risk.all() });
}
