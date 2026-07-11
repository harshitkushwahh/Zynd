"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Info,
  Search,
  ShoppingCart,
} from "lucide-react";
import { DashboardActivePageCard } from "@/components/dashboard/dashboard-active-page-card";
import { DashboardSearchDialog } from "@/components/dashboard/dashboard-search-dialog";
import { NotificationPopover } from "@/components/dashboard/notifications/notification-popover";
import { DASHBOARD_HEADER_CLASS } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DASHBOARD_ROUTES,
} from "@/features/dashboard/navigation/dashboard-routes";
import { useDashboardRoute } from "@/features/dashboard/navigation/use-dashboard-route";
import { useTheme } from "@/contexts/theme-context";
import { uiClasses } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

function NavIconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-9 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function DashboardNavbar() {
  const { isRouteActive } = useDashboardRoute();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const navRoutes = DASHBOARD_ROUTES.filter(
    (route) => route.enabled && route.showInTopNav !== false
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (!key || key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      setSearchOpen((open) => !open);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header className={cn(DASHBOARD_HEADER_CLASS, "justify-between gap-3 md:gap-4")}>
        <nav
          className={cn(
            "flex w-fit max-w-[calc(100%-12rem)] shrink-0 items-center overflow-x-auto p-1.5 [scrollbar-width:none] md:max-w-none [&::-webkit-scrollbar]:hidden",
            uiClasses.navSurface
          )}
        >
          {navRoutes.map((tab) => {
            const active = isRouteActive(tab);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.id}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-full)] px-3 py-2.5 text-[13px] leading-tight font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active ? <Icon className="size-3.5 shrink-0" strokeWidth={2.25} /> : null}
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <DashboardActivePageCard />

        <div className={cn("flex items-center", uiClasses.navSurface)}>
          <button
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 outline-none transition-colors",
              "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            )}
            aria-label="Cart"
          >
            <ShoppingCart className="size-4 shrink-0" strokeWidth={2.25} />
            <span className="text-[13px] font-medium leading-none">Cart</span>
          </button>
        </div>

        <div className={cn("flex items-center gap-1 p-1.5", uiClasses.navSurface)}>
          <NavIconButton label="Search" onClick={() => setSearchOpen(true)}>
            <Search className="size-4" />
          </NavIconButton>

          <NotificationPopover />

          <NavIconButton label="Help">
            <Info className="size-4" />
          </NavIconButton>
        </div>

        <div className={cn("flex items-center p-1.5", uiClasses.navSurface)}>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex h-9 items-center">
                  <ThemeToggle theme={theme} onThemeChange={setTheme} />
                </span>
              }
            />
            <TooltipContent side="bottom">
              {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      </header>

      <DashboardSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
