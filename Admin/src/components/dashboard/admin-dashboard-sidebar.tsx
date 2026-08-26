"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ArrowUpRight } from "lucide-react";

import { AdminSidebarBrand } from "@/components/dashboard/admin-sidebar-brand";
import { AdminSidebarUtilityNav } from "@/components/dashboard/admin-sidebar-utility-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  getAdminSidebarNav,
  isAdminChildNavActive,
  isAdminDropdownActive,
  isAdminRouteActive,
  resolveAdminNavRouteLabel,
  type AdminNavChildItem,
  type AdminNavDropdown,
  type AdminNavGroup,
  type AdminNavRoute,
} from "@/lib/admin-navigation";
import { prefetchAdminNavRoute } from "@/lib/admin-nav-prefetch";
import { cn } from "@/lib/utils";

const FOOTER_ROUTE_IDS = new Set(["settings"]);

function filterGroupRoutes(group: AdminNavGroup): AdminNavGroup {
  return {
    ...group,
    routes: group.routes.filter((route) => !FOOTER_ROUTE_IDS.has(route.id)),
    trailingRoutes: group.trailingRoutes?.filter((route) => !FOOTER_ROUTE_IDS.has(route.id)),
  };
}

function AdminSidebarNavItem({
  route,
  active,
  label,
  onPrefetch,
}: {
  route: AdminNavRoute;
  active: boolean;
  label: string;
  onPrefetch?: (routeId: string) => void;
}) {
  const Icon = route.icon;
  const linkProps = route.external
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};
  const handleExternalClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!route.external || event.button !== 0) return;
    event.preventDefault();
    window.open(route.href, "_blank", "noopener,noreferrer");
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={label}
        className={cn("admin-sidebar-menu-button", active && "admin-sidebar-menu-button--active")}
        onMouseEnter={() => onPrefetch?.(route.id)}
        onFocus={() => onPrefetch?.(route.id)}
        render={
          route.external ? (
            <a
              href={route.href}
              {...linkProps}
              onClick={handleExternalClick}
              aria-current={active ? "page" : undefined}
            />
          ) : (
            <Link href={route.href} aria-current={active ? "page" : undefined} />
          )
        }
      >
        <Icon />
        <span>{label}</span>
        {route.showTrailingArrow ? (
          <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-sidebar-foreground/50" />
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AdminSidebarChildItem({
  item,
  active,
  onPrefetch,
}: {
  item: AdminNavChildItem;
  active: boolean;
  onPrefetch?: (routeId: string) => void;
}) {
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          size="sm"
          disabled
          tooltip={`${item.label} (not available yet)`}
          className="admin-sidebar-menu-button admin-sidebar-menu-button--child h-8 cursor-not-allowed pl-7 opacity-50"
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
        className={cn(
          "admin-sidebar-menu-button admin-sidebar-menu-button--child h-8 pl-7",
          active && "admin-sidebar-menu-button--active",
        )}
        onMouseEnter={() => onPrefetch?.(item.id)}
        onFocus={() => onPrefetch?.(item.id)}
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
  onPrefetch,
}: {
  dropdown: AdminNavDropdown;
  pathname: string;
  onPrefetch?: (routeId: string) => void;
}) {
  const sectionActive = isAdminDropdownActive(pathname, dropdown);
  const [open, setOpen] = useState(sectionActive);
  const Icon = dropdown.icon;

  useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={sectionActive}
        tooltip={dropdown.label}
        className={cn(
          "admin-sidebar-menu-button",
          sectionActive && "admin-sidebar-menu-button--active",
        )}
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
        <SidebarMenu className="admin-sidebar-submenu mt-1 gap-0.5">
          {dropdown.children.map((child) => (
            <AdminSidebarChildItem
              key={child.id}
              item={child}
              active={isAdminChildNavActive(pathname, child.href)}
              onPrefetch={onPrefetch}
            />
          ))}
        </SidebarMenu>
      ) : null}
    </SidebarMenuItem>
  );
}

function AdminSidebarSectionLabel({ label }: { label: string }) {
  return (
    <div className="admin-sidebar-section-head">
      <SidebarGroupLabel className="admin-sidebar-section-label">{label}</SidebarGroupLabel>
    </div>
  );
}

export function AdminDashboardSidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { hasPermission, hasRole, roleKeys } = useAdminAuth();
  const { overview, groups } = getAdminSidebarNav(hasPermission);
  const visibleGroups = groups.map(filterGroupRoutes).filter(
    (group) =>
      group.routes.length > 0 ||
      (group.dropdowns?.length ?? 0) > 0 ||
      (group.trailingRoutes?.length ?? 0) > 0,
  );

  const prefetchAuth = useMemo(
    () => ({
      hasPermission,
      hasRole,
    }),
    [hasPermission, hasRole],
  );

  const handlePrefetch = useCallback(
    (routeId: string) => {
      void prefetchAdminNavRoute(queryClient, routeId, prefetchAuth);
    },
    [prefetchAuth, queryClient],
  );

  return (
    <Sidebar collapsible="none" data-slot="admin-sidebar" className="admin-sidebar-chrome hidden bg-transparent md:flex">
      <SidebarHeader className="admin-sidebar-header">
        <AdminSidebarBrand />
      </SidebarHeader>

      <SidebarContent className="admin-sidebar-content">
        {overview ? (
          <SidebarGroup className="admin-sidebar-group">
            <AdminSidebarSectionLabel label="Menu" />
            <SidebarGroupContent>
              <SidebarMenu className="admin-sidebar-menu">
                <AdminSidebarNavItem
                  route={overview}
                  active={isAdminRouteActive(pathname, overview)}
                  label={resolveAdminNavRouteLabel(overview, roleKeys)}
                  onPrefetch={handlePrefetch}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label} className="admin-sidebar-group">
            <AdminSidebarSectionLabel label={group.label} />
            <SidebarGroupContent>
              <SidebarMenu className="admin-sidebar-menu">
                {group.routes.map((route) => (
                  <AdminSidebarNavItem
                    key={route.id}
                    route={route}
                    active={isAdminRouteActive(pathname, route)}
                    label={resolveAdminNavRouteLabel(route, roleKeys)}
                    onPrefetch={handlePrefetch}
                  />
                ))}
                {group.dropdowns?.map((dropdown) => (
                  <AdminSidebarDropdown
                    key={dropdown.id}
                    dropdown={dropdown}
                    pathname={pathname}
                    onPrefetch={handlePrefetch}
                  />
                ))}
                {group.trailingRoutes?.map((route) => (
                  <AdminSidebarNavItem
                    key={route.id}
                    route={route}
                    active={isAdminRouteActive(pathname, route)}
                    label={resolveAdminNavRouteLabel(route, roleKeys)}
                    onPrefetch={handlePrefetch}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="admin-sidebar-footer">
        <div className="admin-sidebar-footer__card">
          <AdminSidebarUtilityNav />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminDashboardMobileNav() {
  const pathname = usePathname();
  const { hasPermission, roleKeys } = useAdminAuth();
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
        const label = resolveAdminNavRouteLabel(route, roleKeys);
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
              <span>{label.split(" ")[0]}</span>
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
              <span>{label.split(" ")[0]}</span>
            </Link>
          )
        );
      })}
    </nav>
  );
}
