"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

import type { SettingsSection } from "@/components/dashboard/settings/settings-sidebar";
import { useAuth } from "@/contexts/auth-context";
import { useKycOptional } from "@/contexts/kyc-context";
import { useSettingsNavigationOptional } from "@/contexts/settings-navigation-context";
const SETTINGS_PATH = "/dashboard/settings";

export function useProfileMenuActions() {
  const router = useRouter();
  const pathname = usePathname();
  const settingsNavigation = useSettingsNavigationOptional();
  const { signOut } = useAuth();
  const kyc = useKycOptional();

  const navigateToSettingsSection = useCallback(
    (section: SettingsSection) => {
      settingsNavigation?.openSettings(section);
      if (pathname !== SETTINGS_PATH) {
        router.push(SETTINGS_PATH);
      }
    },
    [pathname, router, settingsNavigation],
  );

  const openProfile = useCallback(() => {
    navigateToSettingsSection("personal-details");
  }, [navigateToSettingsSection]);

  const openSettings = useCallback(() => {
    navigateToSettingsSection("security");
  }, [navigateToSettingsSection]);

  const openNotifications = useCallback(() => {
    router.push("/dashboard/notifications");
  }, [router]);

  const openKyc = useCallback(() => {
    kyc?.openDialog();
  }, [kyc]);

  const signOutAndRedirect = useCallback(async () => {
    await signOut();
    router.push("/");
    router.refresh();
  }, [router, signOut]);

  return {
    openProfile,
    openSettings,
    openNotifications,
    openKyc,
    signOutAndRedirect,
  };
}
