"use client";

import {
  AdminDashboardMobileNav,
  AdminDashboardSidebar,
} from "@/components/dashboard/admin-dashboard-sidebar";
import { AdminDashboardNavbar } from "@/components/dashboard/admin-dashboard-navbar";
import { ADMIN_MAIN_CONTENT_CLASS } from "@/components/dashboard/admin-dashboard-layout";
import { AdminZyndPinLockScreen } from "@/components/admin-zynd-pin-lock-screen";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAdminZyndPinOptional } from "@/contexts/admin-zynd-pin-context";
import { cn } from "@/lib/utils";

export function AdminDashboardShell({ children }: { children: React.ReactNode }) {
  const pinContext = useAdminZyndPinOptional();

  return (
    <SidebarProvider className="flex h-dvh w-full overflow-hidden">
      {pinContext?.locked ? <AdminZyndPinLockScreen /> : null}

      <div
        className={cn(
          "flex min-h-0 w-full flex-1",
          pinContext?.locked && "pointer-events-none select-none blur-sm",
        )}
      >
        <AdminDashboardSidebar />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AdminDashboardNavbar />

          <SidebarInset className="min-h-0 flex-1 overflow-y-auto">
            <div className={ADMIN_MAIN_CONTENT_CLASS}>{children}</div>
          </SidebarInset>

          <AdminDashboardMobileNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
