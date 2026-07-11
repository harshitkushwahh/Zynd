import { Suspense } from "react";

import { ReferralLeaderboardPanel } from "@/features/referral/components/referral-leaderboard-panel";
import { ReferralLeaderboardSkeleton } from "@/features/referral/components/referral-skeleton";

export default function ReferralLeaderboardPage() {
  return (
    <Suspense fallback={<ReferralLeaderboardSkeleton />}>
      <ReferralLeaderboardPanel />
    </Suspense>
  );
}
