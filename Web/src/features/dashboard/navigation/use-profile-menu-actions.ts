"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import type { SettingsSection } from "@/components/dashboard/settings/settings-sidebar";
import { useAuth } from "@/contexts/auth-context";
import { useKycOptional } from "@/contexts/kyc-context";
import { useSettingsNavigationOptional } from "@/contexts/settings-navigation-context";
import { checkKycReadiness } from "@/features/kyc/lib/kyc-api";

const SETTINGS_PATH = "/dashboard/settings";

export function useProfileMenuActions() {
  const router = useRouter();
  const pathname = usePathname();
  const settingsNavigation = useSettingsNavigationOptional();
  const { signOut } = useAuth();
  const kyc = useKycOptional();
  const [checkingKraStatus, setCheckingKraStatus] = useState(false);

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

  const checkKycStatus = useCallback(async () => {
    if (!kyc || checkingKraStatus) return;

    setCheckingKraStatus(true);
    try {
      const result = await checkKycReadiness();
      kyc.applyReadinessCheck(result);
      await kyc.refreshFromBootstrap();
      if (!result.kra_verified) {
        kyc.openDialog();
      }
    } finally {
      setCheckingKraStatus(false);
    }
  }, [checkingKraStatus, kyc]);

  const signOutAndRedirect = useCallback(async () => {
    await signOut();
    router.push("/");
    router.refresh();
  }, [router, signOut]);

  return {
    checkingKraStatus,
    openProfile,
    openSettings,
    openNotifications,
    openKyc,
    checkKycStatus,
    signOutAndRedirect,
  };
}
