import type { LucideIcon } from "lucide-react";

import {
  ADMIN_PAGE_DESCRIPTION_CLASS,
  ADMIN_PAGE_TITLE_CLASS,
} from "@/components/dashboard/admin-typography";
import { cn } from "@/lib/utils";

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  aside?: React.ReactNode;
  titleAddon?: React.ReactNode;
  className?: string;
};

export function AdminPageHeader({
  title,
  description,
  icon: Icon,
  aside,
  titleAddon,
  className,
}: AdminPageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className={ADMIN_PAGE_TITLE_CLASS}>{title}</h1>
          {titleAddon}
        </div>
        {description ? <p className={ADMIN_PAGE_DESCRIPTION_CLASS}>{description}</p> : null}
      </div>
      {aside ??
        (Icon ? (
          <div className="admin-page-icon-tile shrink-0">
            <Icon className="size-5" />
          </div>
        ) : null)}
    </div>
  );
}
