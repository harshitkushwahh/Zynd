import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export function invalidateInvestQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.invest.all() });
}
