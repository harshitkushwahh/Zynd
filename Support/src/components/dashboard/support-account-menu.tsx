"use client";

import { useRouter } from "next/navigation";
import { LogOut, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SupportProfileAvatar } from "@/components/ui/support-profile-avatar";
import { useSupportAuth } from "@/contexts/support-auth-context";
import {
  SUPPORT_ACCOUNT_MENU_CLASS,
  SUPPORT_ACCOUNT_MENU_PROFILE_CLASS,
} from "@/lib/support-layout";

function formatRoleLabel(role: string): string {
  return role
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function SupportAccountMenu() {
  const router = useRouter();
  const { user, displayName, signOut } = useSupportAuth();
  const roleLabel = user?.role ? formatRoleLabel(user.role) : "Support";
  const email = user?.email?.trim() || null;

  const handleSignOut = () => {
    void signOut().finally(() => {
      router.replace("/");
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="distributor-account-menu__trigger size-10 shrink-0 rounded-full bg-transparent p-0 hover:bg-transparent"
            aria-label={`Open account menu for ${displayName}`}
          >
            <SupportProfileAvatar
              name={displayName}
              size="md"
              className="distributor-account-menu__trigger-avatar"
            />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className={SUPPORT_ACCOUNT_MENU_CLASS}>
        <div className={SUPPORT_ACCOUNT_MENU_PROFILE_CLASS}>
          <SupportProfileAvatar
            name={displayName}
            size="lg"
            className="distributor-account-menu__avatar"
          />
          <div className="distributor-account-menu__identity">
            <p className="distributor-account-menu__name">{displayName}</p>
            <span className="distributor-account-menu__role">{roleLabel}</span>
          </div>
        </div>

        {email ? (
          <div className="distributor-account-menu__meta">
            <div className="distributor-account-menu__meta-row">
              <span className="distributor-account-menu__meta-icon" aria-hidden>
                <Mail className="size-3.5" strokeWidth={2.25} />
              </span>
              <span className="distributor-account-menu__meta-copy">
                <span className="distributor-account-menu__meta-label">Email</span>
                <span className="distributor-account-menu__meta-value">{email}</span>
              </span>
            </div>
          </div>
        ) : null}

        <DropdownMenuSeparator className="distributor-account-menu__separator" />

        <div className="distributor-account-menu__items">
          <DropdownMenuItem
            variant="destructive"
            className="distributor-account-menu__item"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" strokeWidth={2.25} />
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
