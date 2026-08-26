import { MfCartPageSkeleton } from "@/features/invest/components/mf-cart-page-skeleton";
import { MfBreadcrumb } from "@/features/invest/components/mf-breadcrumb";
import { MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export default function MutualFundsCartLoading() {
  return (
    <div className={cn(MF_PAGE_SECTION_CLASS, "w-full min-w-0 max-w-full space-y-6")}>
      <MfBreadcrumb trail={[{ label: copy.mutualFunds.cartTitle }]} />
      <MfCartPageSkeleton />
    </div>
  );
}
