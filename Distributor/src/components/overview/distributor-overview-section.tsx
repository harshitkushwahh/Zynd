import type { ReactNode } from "react";

type DistributorOverviewSectionProps = {
  title: string;
  children: ReactNode;
};

export function DistributorOverviewSection({ title, children }: DistributorOverviewSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-body font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
