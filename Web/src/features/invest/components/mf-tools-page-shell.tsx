"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { MfBreadcrumb, type MfBreadcrumbItem } from "@/features/invest/components/mf-breadcrumb";
import { MfDashboardSidebar } from "@/features/invest/components/mf-dashboard-sidebar";
import { MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";

type MfToolsPageShellProps = {
  trail: MfBreadcrumbItem[];
  title: string;
  icon: LucideIcon;
  children: ReactNode;
};

export function MfToolsPageShell({ trail, title, icon, children }: MfToolsPageShellProps) {
  return (
    <div className={MF_PAGE_SECTION_CLASS}>
      <MfBreadcrumb trail={trail} />

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <PageHeader icon={icon} title={title} />
          {children}
        </div>

        <MfDashboardSidebar />
      </div>
    </div>
  );
}
