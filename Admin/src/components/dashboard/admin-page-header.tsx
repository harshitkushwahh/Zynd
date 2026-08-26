import type { LucideIcon } from "lucide-react";

import { ADMIN_PAGE_TITLE_CLASS } from "@/components/dashboard/admin-typography";
import { cn } from "@/lib/utils";

type AdminPageHeaderIconVariant = "plain" | "tile";

type AdminPageHeaderIconProps = {
  icon: LucideIcon;
  variant?: AdminPageHeaderIconVariant;
  className?: string;
};

export function AdminPageHeaderIcon({
  icon: Icon,
  variant = "plain",
  className,
}: AdminPageHeaderIconProps) {
  if (variant === "tile") {
    return (
      <div className={cn("admin-page-icon-tile shrink-0", className)}>
        <Icon className="size-5" aria-hidden />
      </div>
    );
  }

  return <Icon className={cn("admin-page-header__icon size-5 shrink-0", className)} aria-hidden />;
}

type AdminPageHeaderProps = {
  title: string;
  icon?: LucideIcon;
  iconVariant?: AdminPageHeaderIconVariant;
  aside?: React.ReactNode;
  titleAddon?: React.ReactNode;
  className?: string;
};

export function AdminPageHeader({
  title,
  icon: Icon,
  iconVariant = "plain",
  aside,
  titleAddon,
  className,
}: AdminPageHeaderProps) {
  const headerIcon = Icon ? <AdminPageHeaderIcon icon={Icon} variant={iconVariant} /> : null;

  return (
    <div className={cn("admin-page-header flex items-start justify-between gap-4", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className={ADMIN_PAGE_TITLE_CLASS}>{title}</h1>
          {titleAddon ? (
            <div className="flex min-h-6 flex-wrap items-center gap-2">{titleAddon}</div>
          ) : null}
        </div>
      </div>
      {aside ?? headerIcon}
    </div>
  );
}
