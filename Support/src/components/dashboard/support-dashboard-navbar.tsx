"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";

import { SUPPORT_NAVBAR_HEIGHT } from "@/components/dashboard/support-dashboard-layout";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSupportAuth } from "@/contexts/support-auth-context";
import { useTheme } from "@/contexts/theme-context";
import { getSupportActiveRoute } from "@/lib/support-navigation";
import { cn } from "@/lib/utils";

export function SupportDashboardNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, displayName, signOut } = useSupportAuth();
  const { theme, setTheme } = useTheme();
  const activeRoute = getSupportActiveRoute(pathname);
  const roleLabel = user?.role ? user.role.replaceAll("_", " ") : "support";

  const handleSignOut = () => {
    signOut();
    router.replace("/");
  };

  return (
    <header
      className={cn(
        SUPPORT_NAVBAR_HEIGHT,
        "flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 md:px-6",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="hidden md:inline-flex" />
        <div className="min-w-0">
          <p className="truncate text-body font-semibold text-foreground">{activeRoute.label}</p>
          <p className="truncate text-caption text-muted-foreground">{activeRoute.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle theme={theme} onThemeChange={setTheme} />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                className="h-10 gap-2 rounded-full px-2"
                aria-label="Account menu"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback>{user?.initials ?? "SU"}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[9rem] truncate text-compact sm:inline">
              {displayName}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex items-center gap-2">
                  <UserRound className="size-3.5 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-compact font-medium">{displayName}</p>
                    <p className="truncate text-caption capitalize text-muted-foreground">
                      {roleLabel}
                    </p>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
