"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";

import { DistributorDashboardSearchDialog } from "@/components/dashboard/distributor-dashboard-search-dialog";
import { DistributorBranchBadge } from "@/components/dashboard/distributor-branch-badge";
import { DistributorDashboardTransactionActions } from "@/components/dashboard/distributor-dashboard-transaction-actions";
import { DistributorNotificationPopover } from "@/components/dashboard/distributor-notification-popover";
import { SearchConsoleTrigger } from "@/components/dashboard/search-console-trigger";
import {
  DISTRIBUTOR_NAVBAR_INNER_CLASS,
  DISTRIBUTOR_NAVBAR_OUTER_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";
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
import { useDistributorAuth } from "@/contexts/distributor-auth-context";

export function DistributorDashboardNavbar({ className }: { className?: string }) {
  const router = useRouter();
  const { user, displayName, signOut, branchLabel } = useDistributorAuth();
  const roleLabel = user?.role ? user.role.replaceAll("_", " ") : "distributor";
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

  const handleSignOut = () => {
    signOut();
    router.replace("/");
  };

  const openSearch = () => setSearchOpen(true);

  return (
    <>
      <header className={cn(DISTRIBUTOR_NAVBAR_OUTER_CLASS, className)}>
        <div className={DISTRIBUTOR_NAVBAR_INNER_CLASS}>
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="hidden shrink-0 md:inline-flex" />
          <SearchConsoleTrigger onOpen={openSearch} variant="leading" />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DistributorBranchBadge className="hidden sm:flex" />
          <DistributorDashboardTransactionActions />
          <DistributorNotificationPopover />
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 rounded-full"
                  aria-label={`Open account menu for ${displayName}`}
                />
              }
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary/10 text-compact font-medium text-primary">
                  {user?.initials ?? "DI"}
                </AvatarFallback>
              </Avatar>
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
                      {user?.branchName ? (
                        <p className="truncate text-caption text-muted-foreground">{branchLabel}</p>
                      ) : null}
                      <p className="truncate text-caption text-muted-foreground">{user?.email}</p>
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
        </div>
      </header>

      <DistributorDashboardSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
