"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bot,
  Info,
  Search,
  ShoppingCart,
} from "lucide-react";
import { RecommendFundsNavbarButton } from "@/components/dashboard/recommend-funds-navbar-button";
import { DashboardActivePageCard } from "@/components/dashboard/dashboard-active-page-card";
import { DashboardSearchDialog } from "@/components/dashboard/dashboard-search-dialog";
import { NotificationPopover } from "@/components/dashboard/notifications/notification-popover";
import { DASHBOARD_HEADER_CLASS, DASHBOARD_NAV_CLUSTER_CLASS, DASHBOARD_NAV_ITEM_CLASS, DASHBOARD_NAVBAR_CHROME_CLASS, DASHBOARD_NAVBAR_FADE_CLASS, DASHBOARD_NAVBAR_FADE_HEIGHT } from "@/components/dashboard/dashboard-layout";
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
import { useMfCartCount } from "@/features/invest/hooks/use-mf-cart-count";
import { useTheme } from "@/contexts/theme-context";
import { copy } from "@/shared/config/copy";
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
            className="size-10 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
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

function NavIconLink({
  href,
  label,
  children,
  active,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            prefetch={false}
            scroll={false}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors",
              "hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              active && "bg-muted text-foreground",
            )}
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
  const { isRouteActive, pathname } = useDashboardRoute();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const { itemCount: cartItemCount } = useMfCartCount();
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
      <div className={DASHBOARD_NAVBAR_CHROME_CLASS}>
        <header className={cn(DASHBOARD_HEADER_CLASS, "justify-between gap-3 overflow-visible md:gap-4")}>
        <nav
          className={cn(
            "min-w-0 w-fit max-w-[calc(100%-12rem)] md:max-w-none",
            DASHBOARD_NAV_CLUSTER_CLASS,
          )}
        >
          <div className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navRoutes.map((tab) => {
            const active = isRouteActive(tab);
            const Icon = tab.icon;

            if (tab.disabled) {
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger
                    render={
                      <span
                        aria-disabled="true"
                        className={cn(
                          DASHBOARD_NAV_ITEM_CLASS,
                          "cursor-not-allowed text-muted-foreground/50",
                        )}
                      >
                        <Icon className="size-3.5 shrink-0 opacity-50" strokeWidth={2} />
                        {tab.label}
                      </span>
                    }
                  />
                  <TooltipContent side="bottom">Coming soon</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={tab.id}
                href={tab.href}
                prefetch={false}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  DASHBOARD_NAV_ITEM_CLASS,
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("size-3.5 shrink-0", !active && "opacity-70")}
                  strokeWidth={active ? 2.25 : 2}
                />
                {tab.label}
              </Link>
            );
          })}
          </div>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
        <RecommendFundsNavbarButton />

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="zynd-ai-bot-button"
                aria-label={copy.navbar.aiBotLabel}
                aria-disabled="true"
              >
                <span className="zynd-ai-bot-aurora" aria-hidden />
                <span className="zynd-ai-bot-surface">
                  <span className="zynd-ai-bot-fold" aria-hidden />
                  <span className="zynd-ai-bot-points" aria-hidden>
                    {Array.from({ length: 10 }, (_, index) => (
                      <i key={index} className="zynd-ai-bot-point" />
                    ))}
                  </span>
                  <span className="zynd-ai-bot-inner">
                    <Bot className="zynd-ai-bot-icon" strokeWidth={2.5} />
                  </span>
                </span>
              </button>
            }
          />
          <TooltipContent side="bottom">{copy.navbar.aiBotComingSoon}</TooltipContent>
        </Tooltip>

        <DashboardActivePageCard />

        <div className={DASHBOARD_NAV_CLUSTER_CLASS}>
          <Link
            href="/dashboard/mutual-funds/cart"
            prefetch={false}
            scroll={false}
            aria-current={pathname.startsWith("/dashboard/mutual-funds/cart") ? "page" : undefined}
            className={cn(
              DASHBOARD_NAV_ITEM_CLASS,
              "zynd-navbar-cart-link relative px-2.5 outline-none transition-colors",
              "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
            aria-label="Cart"
          >
            <ShoppingCart
              className="zynd-screener-dock-cart-icon size-4 shrink-0"
              strokeWidth={2.25}
            />
            <span className="text-[13px] font-medium leading-none">Cart</span>
            {cartItemCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {cartItemCount > 9 ? "9+" : cartItemCount}
              </span>
            ) : null}
          </Link>
        </div>

        <div className={cn("gap-1", DASHBOARD_NAV_CLUSTER_CLASS)}>
          <NavIconButton label="Search" onClick={() => setSearchOpen(true)}>
            <Search className="size-4" />
          </NavIconButton>

          <NotificationPopover />

          <NavIconLink
            href="/dashboard/about"
            label={copy.about.navLabel}
            active={pathname.startsWith("/dashboard/about")}
          >
            <Info className="size-4" />
          </NavIconLink>
        </div>

        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex shrink-0 items-center">
                <ThemeToggle theme={theme} onThemeChange={setTheme} />
              </span>
            }
          />
          <TooltipContent side="bottom">
            {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          </TooltipContent>
        </Tooltip>
      </div>
      </header>
        <div aria-hidden className={cn(DASHBOARD_NAVBAR_FADE_CLASS, DASHBOARD_NAVBAR_FADE_HEIGHT)} />
      </div>

      <DashboardSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
