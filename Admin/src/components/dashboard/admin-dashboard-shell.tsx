"use client";

import {
  AdminDashboardMobileNav,
  AdminDashboardSidebar,
} from "@/components/dashboard/admin-dashboard-sidebar";
import { AdminDashboardNavbar } from "@/components/dashboard/admin-dashboard-navbar";
import {
  ADMIN_MAIN_COLUMN_CLASS,
  ADMIN_MAIN_SCROLL_CLASS,
  ADMIN_NAVBAR_HEIGHT,
  ADMIN_SHELL_CLASS,
  adminMainContentClass,
} from "@/components/dashboard/admin-dashboard-layout";
import { AdminZyndPinLockScreen } from "@/components/admin-zynd-pin-lock-screen";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { useAdminZyndPinOptional } from "@/contexts/admin-zynd-pin-context";
import { cn } from "@/lib/utils";

function AdminDashboardMainColumn({ children }: { children: React.ReactNode }) {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed";

  const navbarOffsetClass = isMobile
    ? "left-0"
    : collapsed
      ? "left-(--sidebar-width-icon)"
      : "left-(--sidebar-width)";

  return (
    <div className={ADMIN_MAIN_COLUMN_CLASS}>
      <AdminDashboardNavbar className={navbarOffsetClass} />
      <div className={cn(ADMIN_NAVBAR_HEIGHT, "shrink-0")} aria-hidden />

      <SidebarInset className={ADMIN_MAIN_SCROLL_CLASS}>
        <div className={adminMainContentClass(collapsed)}>{children}</div>
      </SidebarInset>

      <AdminDashboardMobileNav />
    </div>
  );
}

export function AdminDashboardShell({ children }: { children: React.ReactNode }) {
  const pinContext = useAdminZyndPinOptional();

  return (
    <SidebarProvider
      data-slot="admin-dashboard-shell"
      className={cn(ADMIN_SHELL_CLASS, "flex h-dvh w-full min-h-0 overflow-hidden")}
    >
      {pinContext?.locked ? <AdminZyndPinLockScreen /> : null}

      <div
        className={cn(
          "admin-dashboard-shell-body flex min-h-0 w-full min-w-0 flex-1",
          pinContext?.locked && "pointer-events-none select-none blur-sm",
        )}
      >
        <AdminDashboardSidebar />
        <AdminDashboardMainColumn>{children}</AdminDashboardMainColumn>
      </div>
    </SidebarProvider>
  );
}
