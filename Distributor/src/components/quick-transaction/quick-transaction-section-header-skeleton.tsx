import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type QuickTransactionSectionHeaderSkeletonProps = {
  titleWidthClassName?: string;
  trailing?: ReactNode;
};

export function QuickTransactionSectionHeaderSkeleton({
  titleWidthClassName = "w-36",
  trailing,
}: QuickTransactionSectionHeaderSkeletonProps) {
  return (
    <div className="quick-txn-wizard__section-head">
      <Skeleton className={cn("h-5 rounded-[var(--radius-control)]", titleWidthClassName)} />
      <div className="quick-txn-wizard__section-head-aside">
        {trailing}
        <Skeleton className="quick-txn-wizard__section-help size-8 shrink-0 rounded-full" />
      </div>
    </div>
  );
}
