import { Suspense } from "react";

import { MfCompareFundsPageSkeleton } from "@/features/invest/components/mf-tools-page-skeleton";
import { MfCompareFundsView } from "@/features/invest/components/mf-compare-funds-view";

export default function MutualFundsComparePage() {
  return (
    <Suspense fallback={<MfCompareFundsPageSkeleton />}>
      <MfCompareFundsView />
    </Suspense>
  );
}
