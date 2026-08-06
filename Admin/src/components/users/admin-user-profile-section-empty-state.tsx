import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type AdminUserProfileSectionEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
};

export function AdminUserProfileSectionEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: AdminUserProfileSectionEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-border px-6 py-empty-state-lg text-center",
        className,
      )}
    >
      <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="mt-3 text-compact font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-caption text-muted-foreground">{description}</p>
    </div>
  );
}
