import { Suspense } from "react";

import { MfLumpsumCalculatorView } from "@/features/invest/components/mf-lumpsum-calculator-view";

export default function MutualFundsLumpsumCalculatorPage() {
  return (
    <Suspense fallback={null}>
      <MfLumpsumCalculatorView />
    </Suspense>
  );
}
