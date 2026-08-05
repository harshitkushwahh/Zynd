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
  headerAside?: React.ReactNode;
  titleAddon?: React.ReactNode;
  children: React.ReactNode;
};

export function AdminSectionPageShell({
  breadcrumbSegments,
  title,
  icon,
  headerAside,
  titleAddon,
  children,
}: AdminSectionPageShellProps) {
  return (
    <div className="admin-section-page-shell">
      <AdminSectionBreadcrumb segments={breadcrumbSegments} />
      <AdminPageHeader
        title={title}
        icon={icon}
        aside={headerAside}
        titleAddon={titleAddon}
      />
      <div className="admin-section-page-shell__content">{children}</div>
    </div>
  );
}
