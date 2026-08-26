import type { LucideIcon } from "lucide-react";

import {
  AdminSectionBreadcrumb,
  type AdminBreadcrumbSegment,
} from "@/components/dashboard/admin-section-breadcrumb";
import { AdminPageHeader } from "@/components/dashboard/admin-page-header";

type AdminSectionPageShellProps = {
  breadcrumbSegments: AdminBreadcrumbSegment[];
  title: string;
  icon?: LucideIcon;
  iconVariant?: "plain" | "tile";
  headerAside?: React.ReactNode;
  titleAddon?: React.ReactNode;
  hideBreadcrumb?: boolean;
  hideHeader?: boolean;
  children: React.ReactNode;
};

export function AdminSectionPageShell({
  breadcrumbSegments,
  title,
  icon,
  iconVariant = "plain",
  headerAside,
  titleAddon,
  hideBreadcrumb = false,
  hideHeader = false,
  children,
}: AdminSectionPageShellProps) {
  return (
    <div className="admin-section-page-shell">
      {!hideBreadcrumb ? <AdminSectionBreadcrumb segments={breadcrumbSegments} /> : null}
      {!hideHeader ? (
        <AdminPageHeader
          title={title}
          icon={icon}
          iconVariant={iconVariant}
          aside={headerAside}
          titleAddon={titleAddon}
        />
      ) : null}
      <div className="admin-section-page-shell__content">{children}</div>
    </div>
  );
}
