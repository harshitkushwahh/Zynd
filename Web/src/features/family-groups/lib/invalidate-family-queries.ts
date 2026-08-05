import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export async function invalidateFamilyQueries(queryClient: QueryClient, groupId?: string) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.family.all() });
  await queryClient.invalidateQueries({ queryKey: queryKeys.goals.familyDashboard() });
  if (groupId) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.family.detail(groupId) });
  }
}
