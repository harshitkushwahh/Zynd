"use client";

import type { ReactNode } from "react";

import { MfBreadcrumb, type MfBreadcrumbItem } from "@/features/invest/components/mf-breadcrumb";
import { MfDashboardSidebar } from "@/features/invest/components/mf-dashboard-sidebar";
import { MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";
import { PageTitle } from "@/components/ui/page-title";

type MfToolsPageShellProps = {
  trail: MfBreadcrumbItem[];
  title: string;
  description: string;
  children: ReactNode;
};

export function MfToolsPageShell({ trail, title, description, children }: MfToolsPageShellProps) {
  return (
    <div className={MF_PAGE_SECTION_CLASS}>
      <MfBreadcrumb trail={trail} />

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <div>
            <PageTitle>{title}</PageTitle>
            <p className="mt-2 max-w-2xl text-compact text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>

        <MfDashboardSidebar />
      </div>
    </div>
  );
}
