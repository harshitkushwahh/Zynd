import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PageTitle } from "@/components/ui/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const PAGE_HEADER_ICON_CLASS = "text-black dark:text-white";
export const PAGE_HEADER_DESCRIPTION_CLASS = "mt-2 max-w-2xl text-compact text-muted-foreground";

type PageHeaderProps = {
  icon?: LucideIcon;
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  loading?: boolean;
  className?: string;
  iconClassName?: string;
  descriptionClassName?: string;
};

export function PageHeader({
  icon: Icon,
  title,
  description,
  action,
  loading = false,
  className,
  iconClassName,
  descriptionClassName,
}: PageHeaderProps) {
  const hasDescription = Boolean(description);
  const rowAlign = hasDescription ? "items-start" : "items-center";

  const heading = (
    <div className={cn("flex min-w-0 gap-3", rowAlign)}>
      {Icon ? (
        <Icon
          className={cn("size-5 shrink-0", iconClassName ?? PAGE_HEADER_ICON_CLASS)}
          strokeWidth={2.25}
          aria-hidden
        />
      ) : null}
      <div className="min-w-0">
        {loading ? (
          <div className={cn(hasDescription && "space-y-2")} aria-hidden="true">
            <Skeleton className="h-7 w-48 max-w-full" />
            {hasDescription ? <Skeleton className="h-4 w-full max-w-xl" /> : null}
          </div>
        ) : (
          <>
            <PageTitle>{title}</PageTitle>
            {description ? (
              <p className={cn(PAGE_HEADER_DESCRIPTION_CLASS, descriptionClassName)}>{description}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  if (action) {
    return (
      <div className={cn("flex flex-wrap justify-between gap-4", rowAlign, className)}>
        {heading}
        <div className="shrink-0">{action}</div>
      </div>
    );
  }

  return <div className={cn("min-w-0", className)}>{heading}</div>;
}
