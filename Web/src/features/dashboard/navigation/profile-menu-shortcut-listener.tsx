"use client";

import { useEffect } from "react";

import { useKycOptional } from "@/contexts/kyc-context";
import {
  matchesProfileMenuShortcut,
  PROFILE_MENU_SHORTCUTS,
} from "@/features/dashboard/navigation/profile-menu-shortcuts";
import { useProfileMenuActions } from "@/features/dashboard/navigation/use-profile-menu-actions";

export function ProfileMenuShortcutListener() {
  const kyc = useKycOptional();
  const { openProfile, openKyc, signOutAndRedirect } = useProfileMenuActions();

  const showKycMenu = Boolean(kyc?.showKycMenu && kyc.kycAllowed && kyc.status !== "complete");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (matchesProfileMenuShortcut(event, PROFILE_MENU_SHORTCUTS.profile)) {
        event.preventDefault();
        openProfile();
        return;
      }

      if (
        showKycMenu &&
        matchesProfileMenuShortcut(event, PROFILE_MENU_SHORTCUTS.kyc)
      ) {
        event.preventDefault();
        openKyc();
        return;
      }

      if (matchesProfileMenuShortcut(event, PROFILE_MENU_SHORTCUTS.signOut)) {
        event.preventDefault();
        void signOutAndRedirect();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openKyc, openProfile, showKycMenu, signOutAndRedirect]);

  return null;
}
