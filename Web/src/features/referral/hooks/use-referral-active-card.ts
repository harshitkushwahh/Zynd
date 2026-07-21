"use client";

import { isReferralPath } from "@/features/referral/lib/referral-navigation";

export function useReferralActiveCard(pathname: string) {
  return {
    isReferralSection: isReferralPath(pathname),
  };
}
