"use client";

import type { CSSProperties } from "react";

import {
  DistributorDashboardMobileNav,
  DistributorDashboardSidebar,
} from "@/components/dashboard/distributor-dashboard-sidebar";
import { DistributorDashboardNavbar } from "@/components/dashboard/distributor-dashboard-navbar";
import { DistributorDashboardBreadcrumb } from "@/components/dashboard/distributor-dashboard-breadcrumb";
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
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed";

  const navbarOffsetClass = isMobile
    ? "left-0"
    : collapsed
      ? "left-(--sidebar-width-icon)"
      : "left-(--sidebar-width)";

  return (
    <div className={DISTRIBUTOR_MAIN_COLUMN_CLASS}>
      <DistributorDashboardNavbar className={navbarOffsetClass} />
      <div className={cn(DISTRIBUTOR_NAVBAR_HEIGHT, "shrink-0")} aria-hidden />

      <SidebarInset className={DISTRIBUTOR_MAIN_SCROLL_CLASS}>
        <div className={DISTRIBUTOR_MAIN_CONTENT_CLASS}>
          <DistributorDashboardBreadcrumb />
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
