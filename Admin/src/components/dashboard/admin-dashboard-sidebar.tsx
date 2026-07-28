"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ArrowUpRight } from "lucide-react";

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
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  getAdminSidebarNav,
  isAdminChildNavActive,
  isAdminDropdownActive,
  isAdminRouteActive,
  type AdminNavChildItem,
  type AdminNavDropdown,
  type AdminNavRoute,
} from "@/lib/admin-navigation";
import { cn } from "@/lib/utils";

function AdminSidebarBrand() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Link
      href="/dashboard"
      className={cn(
        "admin-sidebar-brand",
        collapsed ? "admin-sidebar-brand--collapsed" : "admin-sidebar-brand--expanded",
      )}
      aria-label="ZYND Admin home"
    >
      {collapsed ? (
        <Image
          src="/zynda.png"
          alt="ZYND"
          width={32}
          height={32}
          className="size-8 object-contain object-center"
          priority
        />
      ) : (
        <Image
          src="/zynda-h.png"
          alt="ZYND Admin"
          width={893}
          height={242}
          className="admin-sidebar-brand__logo-horizontal"
          priority
        />
      )}
    </Link>
  );
}

function AdminSidebarNavItem({ route, active }: { route: AdminNavRoute; active: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const Icon = route.icon;
  const linkProps = route.external
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={route.label}
        className="admin-sidebar-menu-button"
        render={
          route.external ? (
            <a href={route.href} {...linkProps} aria-current={active ? "page" : undefined} />
          ) : (
            <Link href={route.href} aria-current={active ? "page" : undefined} />
          )
        }
      >
        <Icon />
        {!collapsed ? (
          <>
            <span>{route.label}</span>
            {route.showTrailingArrow ? (
              <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-sidebar-foreground/50" />
            ) : null}
          </>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AdminSidebarChildItem({ item, active }: { item: AdminNavChildItem; active: boolean }) {
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          size="sm"
          disabled
          tooltip={`${item.label} (not available yet)`}
          className="admin-sidebar-menu-button h-7 cursor-not-allowed pl-6 opacity-50"
        >
          <Icon className="size-3.5" />
          <span>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="sm"
        isActive={active}
        tooltip={item.label}
        className="admin-sidebar-menu-button h-7 pl-6"
        render={<Link href={item.href} aria-current={active ? "page" : undefined} />}
      >
        <Icon className="size-3.5" />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AdminSidebarDropdown({
  dropdown,
  pathname,
  collapsed,
}: {
  dropdown: AdminNavDropdown;
  pathname: string;
  collapsed: boolean;
}) {
  const sectionActive = isAdminDropdownActive(pathname, dropdown);
  const [open, setOpen] = useState(sectionActive);
  const Icon = dropdown.icon;

  useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  if (collapsed) {
    return (
      <AdminSidebarNavItem
        route={{
          id: dropdown.id,
          label: dropdown.label,
          href: dropdown.href,
          icon: dropdown.icon,
        }}
        active={sectionActive}
      />
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={sectionActive}
        tooltip={dropdown.label}
        className="admin-sidebar-menu-button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Icon />
        <span>{dropdown.label}</span>
        <ChevronDown
          className={cn(
            "ml-auto size-4 shrink-0 text-sidebar-foreground/50 transition-transform",
            open && "rotate-180",
          )}
        />
      </SidebarMenuButton>
      {open ? (
        <SidebarMenu className="mt-0.5 gap-0.5 border-l border-sidebar-border/70 pl-2">
          {dropdown.children.map((child) => (
            <AdminSidebarChildItem
              key={child.id}
              item={child}
              active={isAdminChildNavActive(pathname, child.href)}
            />
          ))}
        </SidebarMenu>
      ) : null}
    </SidebarMenuItem>
  );
}

export function AdminDashboardSidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAdminAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { overview, groups } = getAdminSidebarNav(hasPermission);

  return (
    <Sidebar collapsible="icon" variant="sidebar" data-slot="admin-sidebar" className="admin-sidebar-chrome">
      <SidebarHeader
        className={cn(
          "admin-sidebar-header",
          collapsed && "admin-sidebar-header--collapsed",
        )}
      >
        <AdminSidebarBrand />
      </SidebarHeader>

      <SidebarContent className="admin-sidebar-content gap-1 py-2">
        {overview ? (
          <SidebarGroup className="py-1">
            <SidebarGroupContent>
              <SidebarMenu>
                <AdminSidebarNavItem
                  route={overview}
                  active={isAdminRouteActive(pathname, overview)}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            {!collapsed ? (
              <SidebarGroupLabel className="admin-sidebar-section-label h-7 px-3 text-tiny font-medium tracking-wide text-sidebar-foreground/50 uppercase">
                {group.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.routes.map((route) => (
                  <AdminSidebarNavItem
                    key={route.id}
                    route={route}
                    active={isAdminRouteActive(pathname, route)}
                  />
                ))}
                {group.dropdowns?.map((dropdown) => (
                  <AdminSidebarDropdown
                    key={dropdown.id}
                    dropdown={dropdown}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
                {group.trailingRoutes?.map((route) => (
                  <AdminSidebarNavItem
                    key={route.id}
                    route={route}
                    active={isAdminRouteActive(pathname, route)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

export function AdminDashboardMobileNav() {
  const pathname = usePathname();
  const { hasPermission } = useAdminAuth();
  const { overview, groups } = getAdminSidebarNav(hasPermission);
  const routes: AdminNavRoute[] = [
    ...(overview ? [overview] : []),
    ...groups.flatMap((group) => [
      ...group.routes,
      ...(group.dropdowns?.flatMap((dropdown) =>
        dropdown.children.map(
          (child): AdminNavRoute => ({
            id: child.id,
            label: child.label,
            href: child.href,
            icon: child.icon,
          }),
        ),
      ) ?? []),
      ...(group.trailingRoutes ?? []),
    ]),
  ];

  return (
    <nav className="flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur-sm md:hidden">
      {routes.slice(0, 5).map((route) => {
        const Icon = route.icon;
        const active =
          pathname === route.href ||
          pathname.startsWith(`${route.href}/`) ||
          isAdminRouteActive(pathname, route);
        return (
          route.external ? (
            <a
              key={route.id}
              href={route.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex flex-col items-center gap-1 rounded-md px-3 py-2 text-caption transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{route.label.split(" ")[0]}</span>
            </a>
          ) : (
            <Link
              key={route.id}
              href={route.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md px-3 py-2 text-caption transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{route.label.split(" ")[0]}</span>
            </Link>
          )
        );
      })}
    </nav>
  );
}
