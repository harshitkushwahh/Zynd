import type { LucideIcon } from "lucide-react";
import { SearchX } from "lucide-react";

import { cn } from "@/lib/utils";

type TableEmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
};

export function TableEmptyState({
  title,
  description,
  icon: Icon = SearchX,
  className,
}: TableEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      <Icon className="size-10 text-muted-foreground/70" strokeWidth={1.75} aria-hidden />
      <div>
        <p className="text-compact font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 max-w-sm text-caption text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
