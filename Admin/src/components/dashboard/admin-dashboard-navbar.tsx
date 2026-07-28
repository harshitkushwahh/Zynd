"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Search, UserRound } from "lucide-react";

import {
  ADMIN_NAVBAR_INNER_CLASS,
  ADMIN_NAVBAR_OUTER_CLASS,
} from "@/components/dashboard/admin-dashboard-layout";
import { AdminDashboardSearchDialog } from "@/components/dashboard/admin-dashboard-search-dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";

function getInitials(displayName: string, email: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0]) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function AdminDashboardNavbar({ className }: { className?: string }) {
  const router = useRouter();
  const { user, displayName, signOut } = useAdminAuth();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const roleLabel = user?.role ? user.role.replaceAll("_", " ") : "admin";

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

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <>
      <header className={cn(ADMIN_NAVBAR_OUTER_CLASS, className)}>
        <div className={ADMIN_NAVBAR_INNER_CLASS}>
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="hidden md:inline-flex" />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="hidden h-8 w-64 justify-start border border-border/40 bg-muted/30 text-muted-foreground shadow-none hover:border-border hover:bg-background focus-visible:border-border focus-visible:bg-background focus-visible:ring-0 sm:inline-flex md:w-80"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground">Search pages...</span>
                  <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-caption text-muted-foreground">
                    ⌘K
                  </kbd>
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
                  className="border border-border/40 bg-muted/30 shadow-none hover:border-border hover:bg-background focus-visible:border-border focus-visible:bg-background focus-visible:ring-0 sm:hidden"
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

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <ThemeToggle theme={theme} onThemeChange={setTheme} />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label="Open profile menu"
                >
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(displayName, user?.email ?? "AD")}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <p className="text-compact font-medium leading-none">{displayName}</p>
                    <p className="text-caption text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <UserRound className="size-4" />
                <span className="capitalize">{roleLabel}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void handleSignOut()}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </div>
      </header>

      <AdminDashboardSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
