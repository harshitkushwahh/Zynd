import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DistributorOverviewSectionProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function DistributorOverviewSection({
  title,
  children,
  className,
}: DistributorOverviewSectionProps) {
  return (
    <section className={cn(title ? "space-y-3" : undefined, className)}>
      {title ? (
        <h2 className="font-heading text-body font-semibold text-foreground">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}
