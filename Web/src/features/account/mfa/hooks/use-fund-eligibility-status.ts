"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchFundEligibilityStatus } from "@/features/account/api/mfa-api";
import { useAuth } from "@/contexts/auth-context";
import { queryKeys } from "@/lib/query-keys";

export function useFundEligibilityStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.auth.fundEligibility(),
    queryFn: fetchFundEligibilityStatus,
    enabled: Boolean(user),
  });
}
