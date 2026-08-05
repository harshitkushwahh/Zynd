import { Suspense } from "react";

import { MfLumpsumCalculatorPageSkeleton } from "@/features/invest/components/mf-tools-page-skeleton";
import { MfLumpsumCalculatorView } from "@/features/invest/components/mf-lumpsum-calculator-view";

export default function MutualFundsLumpsumCalculatorPage() {
  return (
    <Suspense fallback={<MfLumpsumCalculatorPageSkeleton />}>
      <MfLumpsumCalculatorView />
    </Suspense>
  );
}
