import { Skeleton } from "@/components/ui/skeleton";
import { MF_INVEST_SIDEBAR_WIDTH_CLASS, MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

export function PortfolioHoldingDetailSkeleton() {
  return (
    <div className={cn(MF_PAGE_SECTION_CLASS, "pb-8")} aria-busy="true">
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-4 w-36 max-w-[40vw]" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <Skeleton className={cn("h-52 w-full", ZYND_3XL_RADIUS_CLASS)} />
          <Skeleton className={cn("h-28 w-full", ZYND_3XL_RADIUS_CLASS)} />
          <Skeleton className={cn("h-12 w-full lg:hidden", ZYND_3XL_RADIUS_CLASS)} />
          <Skeleton className={cn("h-10 w-full max-w-sm", ZYND_3XL_RADIUS_CLASS)} />
          <Skeleton className={cn("h-64 w-full", ZYND_3XL_RADIUS_CLASS)} />
        </div>

        <Skeleton
          className={cn(
            "hidden h-[34rem] w-full lg:block",
            MF_INVEST_SIDEBAR_WIDTH_CLASS,
            ZYND_3XL_RADIUS_CLASS,
          )}
        />
      </div>
    </div>
  );
}
