"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchGoalTemplates } from "@/features/goals/api/goals-api";
import { queryKeys } from "@/lib/query-keys";

export function useGoalTemplatesQuery() {
  const query = useQuery({
    queryKey: queryKeys.goals.templates(),
    queryFn: fetchGoalTemplates,
  });

  return {
    ...query,
    templates: query.data?.items ?? [],
  };
}
