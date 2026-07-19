import { Suspense } from "react";

import { MfCompareFundsView } from "@/features/invest/components/mf-compare-funds-view";

export default function MutualFundsComparePage() {
  return (
    <Suspense fallback={null}>
      <MfCompareFundsView />
    </Suspense>
  );
}
