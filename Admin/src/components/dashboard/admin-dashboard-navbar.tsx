"use client";

import { useEffect, useState } from "react";
import { Bell, Search } from "lucide-react";

import { AdminAccountMenu } from "@/components/dashboard/admin-account-menu";
import { ADMIN_NAVBAR_CLASS } from "@/components/dashboard/admin-dashboard-layout";
import { AdminDashboardSearchDialog } from "@/components/dashboard/admin-dashboard-search-dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";

export function AdminDashboardNavbar({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

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
      <nav
        aria-label="Dashboard"
        className={cn(ADMIN_NAVBAR_CLASS, className)}
      >
        <div className="admin-dashboard-navbar-search">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="admin-dashboard-navbar-search__trigger hidden sm:inline-flex"
                    onClick={() => setSearchOpen(true)}
                  >
                    <Search className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">Search pages...</span>
                    <kbd className="admin-dashboard-navbar-search__kbd">⌘K</kbd>
                  </Button>
                }
              />
              <TooltipContent side="bottom">Search pages</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="admin-dashboard-navbar-search__icon sm:hidden"
                    aria-label="Search pages"
                    onClick={() => setSearchOpen(true)}
                  >
                    <Search className="size-4" />
                  </Button>
                }
              />
              <TooltipContent side="bottom">Search</TooltipContent>
            </Tooltip>
          </div>

          <div className="admin-dashboard-navbar-actions">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="admin-dashboard-navbar-action"
                    aria-label="Notifications"
                  >
                    <Bell className="size-4" />
                  </Button>
                }
              />
              <TooltipContent side="bottom">Notifications</TooltipContent>
            </Tooltip>

            <ThemeToggle
              theme={theme}
              onThemeChange={setTheme}
              variant="icon"
              className="admin-dashboard-navbar-action"
            />

            <AdminAccountMenu />
          </div>
      </nav>

      <AdminDashboardSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
