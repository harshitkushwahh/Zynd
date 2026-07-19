import { MutualFundsPageSkeleton } from "@/features/invest/components/mf-mutual-funds-catalog-skeleton";
import { MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";
import { cn } from "@/lib/utils";

export default function MutualFundsLoading() {
  return (
    <div className={cn(MF_PAGE_SECTION_CLASS)}>
      <MutualFundsPageSkeleton />
    </div>
  );
}
