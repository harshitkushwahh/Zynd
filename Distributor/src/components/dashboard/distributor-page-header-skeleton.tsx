import { Skeleton } from "@/components/ui/skeleton";

import { cn } from "@/lib/utils";

type DistributorPageHeaderSkeletonProps = {
  className?: string;
  showActions?: boolean;
  titleClassName?: string;
  actionsClassName?: string;
};

export function DistributorPageHeaderSkeleton({
  className,
  showActions = true,
  titleClassName,
  actionsClassName,
}: DistributorPageHeaderSkeletonProps) {
  return (
    <header className={cn("distributor-page-header", className)}>
      <div className="distributor-page-header__lead">
        <div className="distributor-page-header__copy">
          <Skeleton
            className={cn(
              "h-7 w-36 max-w-full rounded-[var(--radius-control)]",
              titleClassName,
            )}
          />
        </div>
      </div>
      {showActions ? (
        <div className="distributor-page-header__actions">
          <Skeleton
            className={cn(
              "h-10 w-full min-w-[18rem] max-w-[36rem] rounded-[var(--radius-full)]",
              actionsClassName,
            )}
          />
        </div>
      ) : null}
    </header>
  );
}
