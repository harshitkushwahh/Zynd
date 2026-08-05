"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  isSupportRouteActive,
  SUPPORT_NAV_ROUTES,
} from "@/lib/support-navigation";
import { cn } from "@/lib/utils";

function SupportSidebarBrand() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex items-center gap-3 rounded-md p-1 transition-colors hover:bg-sidebar-accent",
        collapsed && "justify-center",
      )}
      aria-label="ZYND Support home"
    >
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
        <Image
          src="/logo.png"
          alt="ZYND"
          width={32}
          height={32}
          className="size-8 object-contain"
          priority
        />
      </span>
      {!collapsed ? (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-sidebar-foreground">ZYND</span>
          <span className="block truncate text-xs text-sidebar-foreground/60">Support Console</span>
        </span>
      ) : null}
    </Link>
  );
}

export function SupportDashboardSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <SupportSidebarBrand />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SUPPORT_NAV_ROUTES.map((route) => {
                const Icon = route.icon;
                const active = isSupportRouteActive(pathname, route.href);
                return (
                  <SidebarMenuItem key={route.id}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={route.label}
                      render={
                        <Link href={route.href} aria-current={active ? "page" : undefined} />
                      }
                    >
                      <Icon />
                      <span>{route.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

export function SupportDashboardMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-[var(--blur-sm)] md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-1 px-2 py-2">
        {SUPPORT_NAV_ROUTES.map((route) => {
          const Icon = route.icon;
          const active = isSupportRouteActive(pathname, route.href);
          return (
            <Link
              key={route.id}
              href={route.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px]",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span className="truncate">{route.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
