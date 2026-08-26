import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { MfPaymentReturnView } from "@/features/invest/components/mf-payment-return-view";
import { MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";

function PaymentReturnFallback() {
  return (
    <div className={`${MF_PAGE_SECTION_CLASS} flex min-h-[240px] items-center justify-center text-muted-foreground`}>
      <Loader2 className="mr-2 size-5 animate-spin" />
      {copy.mutualFunds.orderPayReturnConfirming}
    </div>
  );
}

export default function MutualFundPaymentReturnPage() {
  return (
    <Suspense fallback={<PaymentReturnFallback />}>
      <MfPaymentReturnView />
    </Suspense>
  );
}
