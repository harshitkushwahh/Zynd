"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, Settings } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { canAccessAdminRoute, isAdminRouteActive, ADMIN_NAV_ROUTES } from "@/lib/admin-navigation";
import { cn } from "@/lib/utils";

const settingsRoute = ADMIN_NAV_ROUTES.find((route) => route.id === "settings");

export function AdminSidebarUtilityNav() {
  const pathname = usePathname();
  const { hasPermission } = useAdminAuth();
  const showSettings =
    settingsRoute != null && canAccessAdminRoute(settingsRoute, hasPermission);
  const settingsActive = settingsRoute
    ? isAdminRouteActive(pathname, settingsRoute)
    : false;

  return (
    <SidebarMenu className="admin-sidebar-utility-nav">
      {showSettings ? (
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={settingsActive}
            tooltip="Settings"
            className={cn(
              "admin-sidebar-menu-button",
              settingsActive && "admin-sidebar-menu-button--active",
            )}
            render={<Link href={settingsRoute!.href} aria-current={settingsActive ? "page" : undefined} />}
          >
            <Settings />
            <span>Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ) : null}

      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Support"
          className="admin-sidebar-menu-button"
          render={
            <a
              href="mailto:support@zynd.in"
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <CircleHelp />
          <span>Support</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
