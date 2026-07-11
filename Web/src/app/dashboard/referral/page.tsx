import { Suspense } from "react";

import { ReferralDashboardPanel } from "@/features/referral/components/referral-dashboard-panel";
import { ReferralDashboardSkeleton } from "@/features/referral/components/referral-skeleton";

export default function ReferralPage() {
  return (
    <Suspense fallback={<ReferralDashboardSkeleton />}>
      <ReferralDashboardPanel />
    </Suspense>
  );
}
