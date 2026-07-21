import { Suspense } from "react";

import { MfSipCalculatorPageSkeleton } from "@/features/invest/components/mf-tools-page-skeleton";
import { MfSipCalculatorView } from "@/features/invest/components/mf-sip-calculator-view";

export default function MutualFundsSipCalculatorPage() {
  return (
    <Suspense fallback={<MfSipCalculatorPageSkeleton />}>
      <MfSipCalculatorView />
    </Suspense>
  );
}
