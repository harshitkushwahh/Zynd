import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

type AdminFamilyGroupChartEmptyStateProps = {
  label: string;
  description?: string;
  className?: string;
};

export function AdminFamilyGroupChartEmptyState({
  label,
  description,
  className,
}: AdminFamilyGroupChartEmptyStateProps) {
  return (
    <div
      className={cn(
        "admin-family-group-chart-empty-state flex flex-col items-center rounded-card border border-dashed border-border bg-muted/15 px-6 py-empty-state-lg text-center",
        className,
      )}
    >
      <div className="rounded-full bg-muted/40 p-4 text-muted-foreground">
        <Inbox className="size-8" strokeWidth={1.75} aria-hidden />
      </div>
      <p className="mt-4 font-medium text-foreground">{label}</p>
      {description ? (
        <p className="mt-1 max-w-md text-caption leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
