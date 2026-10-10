"use client";

import type { CSSProperties } from "react";
import { Suspense } from "react";

import {
  SupportDashboardMobileNav,
  SupportDashboardSidebar,
} from "@/components/dashboard/support-dashboard-sidebar";
import { SupportDashboardNavbar } from "@/components/dashboard/support-dashboard-navbar";
import { SupportDashboardBreadcrumb } from "@/components/dashboard/support-dashboard-breadcrumb";
import { SupportPageChromeProvider } from "@/components/dashboard/support-page-chrome-context";
import {
  SUPPORT_MAIN_COLUMN_CLASS,
  SUPPORT_MAIN_CONTENT_CLASS,
  SUPPORT_MAIN_SCROLL_CLASS,
  SUPPORT_NAVBAR_HEIGHT,
  SUPPORT_SHELL_CLASS,
  SUPPORT_SIDEBAR_EXPANDED_WIDTH,
  SUPPORT_SIDEBAR_ICON_WIDTH,
} from "@/lib/support-layout";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function SupportDashboardMainColumn({ children }: { children: React.ReactNode }) {
  const { isMobile } = useSidebar();

  const navbarOffsetClass = isMobile ? "left-0" : "left-(--sidebar-width-icon)";

  return (
    <div className={SUPPORT_MAIN_COLUMN_CLASS}>
      <SupportDashboardNavbar className={navbarOffsetClass} />
      <div className={cn(SUPPORT_NAVBAR_HEIGHT, "shrink-0")} aria-hidden />

      <SidebarInset className={SUPPORT_MAIN_SCROLL_CLASS}>
        <SupportPageChromeProvider>
          <div className={SUPPORT_MAIN_CONTENT_CLASS}>
            <Suspense fallback={<div className="distributor-breadcrumb-row" aria-hidden />}>
              <SupportDashboardBreadcrumb />
            </Suspense>
            {children}
          </div>
        </SupportPageChromeProvider>
      </SidebarInset>

      <SupportDashboardMobileNav />
    </div>
  );
}

export function SupportDashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      data-slot="support-dashboard-shell"
      className={SUPPORT_SHELL_CLASS}
      open={false}
      onOpenChange={() => {}}
      defaultOpen={false}
      style={
        {
          "--sidebar-width": SUPPORT_SIDEBAR_EXPANDED_WIDTH,
          "--sidebar-width-icon": SUPPORT_SIDEBAR_ICON_WIDTH,
        } as CSSProperties
      }
    >
      <SupportDashboardSidebar />
      <SupportDashboardMainColumn>{children}</SupportDashboardMainColumn>
    </SidebarProvider>
  );
}
