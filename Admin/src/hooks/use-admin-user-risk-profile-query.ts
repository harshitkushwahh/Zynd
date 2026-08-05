"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-client";
import {
  fetchUserRiskProfile,
  fetchUserRiskProfileAssessments,
  type UserRiskProfileAssessmentItem,
  type UserRiskProfileDetail,
} from "@/lib/risk-profile-admin-api";

export type AdminUserRiskProfileData = {
  profile: UserRiskProfileDetail | null;
  assessments: UserRiskProfileAssessmentItem[];
  notFound: boolean;
};

export function adminUserRiskProfileQueryKey(userId: string) {
  return ["admin-user-risk-profile", userId] as const;
}

export function useAdminUserRiskProfileQuery(userId: string) {
  return useQuery({
    queryKey: adminUserRiskProfileQueryKey(userId),
    queryFn: async (): Promise<AdminUserRiskProfileData> => {
      try {
        const [profile, assessmentsResult] = await Promise.all([
          fetchUserRiskProfile(userId),
          fetchUserRiskProfileAssessments(userId),
        ]);
        return {
          profile,
          assessments: assessmentsResult.items,
          notFound: false,
        };
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return { profile: null, assessments: [], notFound: true };
        }
        throw err;
      }
    },
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });
}
