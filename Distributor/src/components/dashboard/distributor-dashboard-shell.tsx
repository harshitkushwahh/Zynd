"use client";

import type { CSSProperties } from "react";
import { Suspense } from "react";

import {
  DistributorDashboardMobileNav,
  DistributorDashboardSidebar,
} from "@/components/dashboard/distributor-dashboard-sidebar";
import { DistributorDashboardNavbar } from "@/components/dashboard/distributor-dashboard-navbar";
import { DistributorDashboardBreadcrumb } from "@/components/dashboard/distributor-dashboard-breadcrumb";
import { DistributorDocumentTitleSync } from "@/components/dashboard/distributor-document-title-sync";
import { QuickTransactionSuccessDialogHost } from "@/components/quick-transaction/quick-transaction-success-dialog";
import {
  DISTRIBUTOR_MAIN_CONTENT_CLASS,
  DISTRIBUTOR_MAIN_COLUMN_CLASS,
  DISTRIBUTOR_MAIN_SCROLL_CLASS,
  DISTRIBUTOR_NAVBAR_HEIGHT,
  DISTRIBUTOR_SHELL_CLASS,
  DISTRIBUTOR_SIDEBAR_EXPANDED_WIDTH,
  DISTRIBUTOR_SIDEBAR_ICON_WIDTH,
} from "@/lib/distributor-layout";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function DistributorDashboardMainColumn({ children }: { children: React.ReactNode }) {
  const { isMobile } = useSidebar();

  const navbarOffsetClass = isMobile ? "left-0" : "left-(--sidebar-width-icon)";

  return (
    <div className={DISTRIBUTOR_MAIN_COLUMN_CLASS}>
      <DistributorDashboardNavbar className={navbarOffsetClass} />
      <div className={cn(DISTRIBUTOR_NAVBAR_HEIGHT, "shrink-0")} aria-hidden />

      <SidebarInset className={DISTRIBUTOR_MAIN_SCROLL_CLASS}>
        <DistributorDocumentTitleSync />
        <div className={DISTRIBUTOR_MAIN_CONTENT_CLASS}>
          <Suspense fallback={<div className="distributor-breadcrumb-row" aria-hidden />}>
            <DistributorDashboardBreadcrumb />
          </Suspense>
          {children}
        </div>
      </SidebarInset>

      <DistributorDashboardMobileNav />
    </div>
  );
}

export function DistributorDashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      data-slot="distributor-dashboard-shell"
      className={DISTRIBUTOR_SHELL_CLASS}
      open={false}
      onOpenChange={() => {}}
      defaultOpen={false}
      style={
        {
          "--sidebar-width": DISTRIBUTOR_SIDEBAR_EXPANDED_WIDTH,
          "--sidebar-width-icon": DISTRIBUTOR_SIDEBAR_ICON_WIDTH,
        } as CSSProperties
      }
    >
      <DistributorDashboardSidebar />
      <DistributorDashboardMainColumn>{children}</DistributorDashboardMainColumn>
      <QuickTransactionSuccessDialogHost />
    </SidebarProvider>
  );
}
