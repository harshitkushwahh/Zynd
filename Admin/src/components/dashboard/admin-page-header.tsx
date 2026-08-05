import type { LucideIcon } from "lucide-react";

import { ADMIN_PAGE_TITLE_CLASS } from "@/components/dashboard/admin-typography";
import { cn } from "@/lib/utils";

type AdminPageHeaderProps = {
  title: string;
  icon?: LucideIcon;
  aside?: React.ReactNode;
  titleAddon?: React.ReactNode;
  className?: string;
};

export function AdminPageHeader({
  title,
  icon: Icon,
  aside,
  titleAddon,
  className,
}: AdminPageHeaderProps) {
  return (
    <div className={cn("admin-page-header flex items-start justify-between gap-4", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className={ADMIN_PAGE_TITLE_CLASS}>{title}</h1>
          {titleAddon}
        </div>
      </div>
      {aside ??
        (Icon ? (
          <Icon className="admin-page-header__icon size-5 shrink-0" aria-hidden />
        ) : null)}
    </div>
  );
}
