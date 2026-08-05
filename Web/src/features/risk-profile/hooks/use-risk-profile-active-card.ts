"use client";

import { isRiskProfilePath } from "@/features/risk-profile/lib/risk-profile-navigation";

export function useRiskProfileActiveCard(pathname: string) {
  return {
    isRiskProfileSection: isRiskProfilePath(pathname),
  };
}
