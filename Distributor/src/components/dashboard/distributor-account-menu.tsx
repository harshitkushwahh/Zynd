"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Mail, MapPin, Settings } from "lucide-react";

import { DistributorCodeCopyBadge } from "@/components/dashboard/distributor-code-copy-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DistributorProfileAvatar } from "@/components/ui/distributor-profile-avatar";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { formatDistributorBranchName } from "@/lib/distributor-branch-display";
import {
  DISTRIBUTOR_ACCOUNT_MENU_CLASS,
  DISTRIBUTOR_ACCOUNT_MENU_PROFILE_CLASS,
} from "@/lib/distributor-layout";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

function formatRoleLabel(role: string): string {
  return role
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function DistributorAccountMenu() {
  const router = useRouter();
  const { user, displayName, signOut, branchLabel } = useDistributorAuth();
  const roleLabel = user?.role ? formatRoleLabel(user.role) : ZYND_MITRA_COPY.defaultRoleLabel;
  const distributorCode = user?.zyndClientId?.trim() ?? "";
  const branchDisplay = user?.branchName ? formatDistributorBranchName(branchLabel) : null;
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
            <DistributorProfileAvatar
              name={displayName}
              imageSrc={user?.avatarUrl}
              size="md"
              className="distributor-account-menu__trigger-avatar"
            />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className={DISTRIBUTOR_ACCOUNT_MENU_CLASS}>
        <div className={DISTRIBUTOR_ACCOUNT_MENU_PROFILE_CLASS}>
          <DistributorProfileAvatar
            name={displayName}
            imageSrc={user?.avatarUrl}
            size="lg"
            className="distributor-account-menu__avatar"
          />
          <div className="distributor-account-menu__identity">
            <p className="distributor-account-menu__name">{displayName}</p>
            <span className="distributor-account-menu__role">{roleLabel}</span>
          </div>
        </div>

        <div className="distributor-account-menu__meta">
          {branchDisplay ? (
            <div className="distributor-account-menu__meta-row">
              <span className="distributor-account-menu__meta-icon" aria-hidden>
                <MapPin className="size-3.5" strokeWidth={2.25} />
              </span>
              <span className="distributor-account-menu__meta-copy">
                <span className="distributor-account-menu__meta-label">Branch</span>
                <span className="distributor-account-menu__meta-value">{branchDisplay}</span>
              </span>
            </div>
          ) : null}
          {email ? (
            <div className="distributor-account-menu__meta-row">
              <span className="distributor-account-menu__meta-icon" aria-hidden>
                <Mail className="size-3.5" strokeWidth={2.25} />
              </span>
              <span className="distributor-account-menu__meta-copy">
                <span className="distributor-account-menu__meta-label">Email</span>
                <span className="distributor-account-menu__meta-value">{email}</span>
              </span>
            </div>
          ) : null}
          {distributorCode ? (
            <DistributorCodeCopyBadge
              distributorCode={distributorCode}
              placement="menu"
            />
          ) : null}
        </div>

        <DropdownMenuSeparator className="distributor-account-menu__separator" />

        <div className="distributor-account-menu__items">
          <DropdownMenuItem
            className="distributor-account-menu__item"
            render={<Link href="/dashboard/settings" />}
          >
            <Settings className="size-4" strokeWidth={2.25} />
            Settings
          </DropdownMenuItem>
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
