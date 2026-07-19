import { Suspense } from "react";

import { MfSipCalculatorView } from "@/features/invest/components/mf-sip-calculator-view";

export default function MutualFundsSipCalculatorPage() {
  return (
    <Suspense fallback={null}>
      <MfSipCalculatorView />
    </Suspense>
  );
}
