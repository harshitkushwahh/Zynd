"use client";

import type React from "react";

import {
  AdminDashboardMobileNav,
  AdminDashboardSidebar,
} from "@/components/dashboard/admin-dashboard-sidebar";
import { AdminDashboardNavbar } from "@/components/dashboard/admin-dashboard-navbar";
import {
  ADMIN_MAIN_COLUMN_CLASS,
  ADMIN_MAIN_SCROLL_CLASS,
  ADMIN_SHELL_CLASS,
  adminMainContentClass,
} from "@/components/dashboard/admin-dashboard-layout";
import { AdminZyndPinLockScreen } from "@/components/admin-zynd-pin-lock-screen";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useAdminZyndPinOptional } from "@/contexts/admin-zynd-pin-context";
import { cn } from "@/lib/utils";

function AdminDashboardMainColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className={ADMIN_MAIN_COLUMN_CLASS}>
      <div className="admin-dashboard-main-card-shell">
        <div className="admin-dashboard-main-top">
          <AdminDashboardNavbar />
        </div>

        <div className="admin-dashboard-main-card">
          <div className="admin-dashboard-main-card__inset">
            <main className={ADMIN_MAIN_SCROLL_CLASS}>
              <div className={adminMainContentClass()}>{children}</div>
            </main>
          </div>
        </div>
      </div>

      <AdminDashboardMobileNav />
    </div>
  );
}

export function AdminDashboardShell({ children }: { children: React.ReactNode }) {
  const pinContext = useAdminZyndPinOptional();

  return (
    <SidebarProvider
      data-slot="admin-dashboard-shell"
      defaultOpen
      style={
        {
          "--sidebar-width": "13rem",
        } as React.CSSProperties
      }
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
