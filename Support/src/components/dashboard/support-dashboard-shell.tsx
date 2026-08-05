"use client";

import {
  SupportDashboardMobileNav,
  SupportDashboardSidebar,
} from "@/components/dashboard/support-dashboard-sidebar";
import { SupportDashboardNavbar } from "@/components/dashboard/support-dashboard-navbar";
import { SUPPORT_MAIN_CONTENT_CLASS } from "@/components/dashboard/support-dashboard-layout";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function SupportDashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="flex h-dvh w-full overflow-hidden">
      <div className="flex min-h-0 w-full flex-1">
        <SupportDashboardSidebar />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SupportDashboardNavbar />

          <SidebarInset className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0">
            <div className={SUPPORT_MAIN_CONTENT_CLASS}>{children}</div>
          </SidebarInset>

          <SupportDashboardMobileNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
