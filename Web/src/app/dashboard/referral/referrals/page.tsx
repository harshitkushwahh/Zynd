import { Suspense } from "react";

import { ReferralYourReferralsPanel } from "@/features/referral/components/referral-your-referrals-panel";
import { ReferralYourReferralsSkeleton } from "@/features/referral/components/referral-skeleton";

export default function ReferralYourReferralsPage() {
  return (
    <Suspense fallback={<ReferralYourReferralsSkeleton />}>
      <ReferralYourReferralsPanel />
    </Suspense>
  );
}
