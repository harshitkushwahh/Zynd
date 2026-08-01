"use client";

import { useRouter } from "next/navigation";
import { LogOut, Mail } from "lucide-react";

import {
  ADMIN_ACCOUNT_MENU_CLASS,
  ADMIN_ACCOUNT_MENU_PROFILE_CLASS,
} from "@/components/dashboard/admin-dashboard-layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminAuth } from "@/contexts/admin-auth-context";
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

function formatRoleLabel(role: string): string {
  return role
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

type AdminAccountMenuProps = {
  className?: string;
};

export function AdminAccountMenu({ className }: AdminAccountMenuProps) {
  const router = useRouter();
  const { user, displayName, signOut } = useAdminAuth();
  const email = user?.email?.trim() || null;
  const roleLabel = user?.role ? formatRoleLabel(user.role) : "Admin";
  const initials = getInitials(displayName, email ?? "AD");

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("admin-account-menu__trigger admin-dashboard-navbar-profile", className)}
            aria-label={`Open account menu for ${displayName}`}
          >
            <Avatar className="admin-account-menu__trigger-avatar size-8">
              <AvatarFallback className="bg-primary/10 text-primary text-caption">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className={ADMIN_ACCOUNT_MENU_CLASS}>
        <div className={ADMIN_ACCOUNT_MENU_PROFILE_CLASS}>
          <Avatar className="admin-account-menu__avatar size-11">
            <AvatarFallback className="bg-primary/10 text-primary text-body font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="admin-account-menu__identity">
            <p className="admin-account-menu__name">{displayName}</p>
            <span className="admin-account-menu__role">{roleLabel}</span>
          </div>
        </div>

        {email ? (
          <div className="admin-account-menu__meta">
            <div className="admin-account-menu__meta-row">
              <span className="admin-account-menu__meta-icon" aria-hidden>
                <Mail className="size-3.5" strokeWidth={2.25} />
              </span>
              <span className="admin-account-menu__meta-copy">
                <span className="admin-account-menu__meta-label">Email</span>
                <span className="admin-account-menu__meta-value">{email}</span>
              </span>
            </div>
          </div>
        ) : null}

        <DropdownMenuSeparator className="admin-account-menu__separator" />

        <div className="admin-account-menu__items">
          <DropdownMenuItem
            variant="destructive"
            className="admin-account-menu__item"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="size-4" strokeWidth={2.25} />
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
