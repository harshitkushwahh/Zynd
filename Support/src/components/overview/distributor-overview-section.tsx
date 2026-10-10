import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DistributorOverviewSectionProps = {
  title?: string;
  /** Rendered on the same row as the title (e.g. “View all”). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DistributorOverviewSection({
  title,
  actions,
  children,
  className,
}: DistributorOverviewSectionProps) {
  const showHeader = Boolean(title || actions);

  return (
    <section className={cn(showHeader ? "space-y-3" : undefined, className)}>
      {showHeader ? (
        <div className="flex items-center justify-between gap-3">
          {title ? (
            <h2 className="font-heading text-body font-semibold text-foreground">{title}</h2>
          ) : (
            <span aria-hidden />
          )}
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
