import type { LucideIcon } from "lucide-react";

import {
  AdminSectionBreadcrumb,
  type AdminBreadcrumbSegment,
} from "@/components/dashboard/admin-section-breadcrumb";
import { AdminPageHeader } from "@/components/dashboard/admin-page-header";

type AdminSectionPageShellProps = {
  breadcrumbSegments: AdminBreadcrumbSegment[];
  title: string;
  description?: string;
  icon?: LucideIcon;
  headerAside?: React.ReactNode;
  children: React.ReactNode;
};

export function AdminSectionPageShell({
  breadcrumbSegments,
  title,
  description,
  icon,
  headerAside,
  children,
}: AdminSectionPageShellProps) {
  return (
    <div className="space-y-6">
      <AdminSectionBreadcrumb segments={breadcrumbSegments} />
      <AdminPageHeader
        title={title}
        description={description}
        icon={icon}
        aside={headerAside}
      />
      {children}
    </div>
  );
}
