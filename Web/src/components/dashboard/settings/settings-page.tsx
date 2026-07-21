"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PersonalDetailsSettingsPanel } from "@/components/dashboard/settings/personal-details-settings-panel";
import { BankAccountSettingsPanel } from "@/components/dashboard/settings/bank-account-settings-panel";
import { useSettingsKycProfile } from "@/components/dashboard/settings/use-settings-kyc-profile";
import { ChangeEmailSettingsPanel } from "@/components/dashboard/settings/change-email-settings-panel";
import { ChangePasswordSettingsPanel } from "@/components/dashboard/settings/change-password-settings-panel";
import { DeleteAccountSettingsPanel } from "@/components/dashboard/settings/delete-account-settings-panel";
import { MfaSettingsPanel } from "@/components/dashboard/settings/mfa-settings-panel";
import { NotificationsSettingsPanel } from "@/components/dashboard/settings/notifications-settings-panel";
import { ZyndPinSettingsPanel } from "@/components/dashboard/settings/zynd-pin-settings-panel";
import {
  SettingsSidebar,
  SETTINGS_NAV,
  type SettingsSection,
} from "@/components/dashboard/settings/settings-sidebar";
import { SettingsPanelHeader } from "@/components/dashboard/settings/settings-panel-header";
import { SettingsContentCard } from "@/components/dashboard/settings/settings-content-card";
import { YourDevicesSettingsPanel } from "@/components/dashboard/settings/your-devices-settings-panel";
import {
  SettingsPageSkeleton,
} from "@/components/dashboard/settings/settings-skeleton";
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { useAuth } from "@/contexts/auth-context";
import { useSettingsNavigation } from "@/contexts/settings-navigation-context";
import {
  fetchMfaBackupCodesStatus,
} from "@/lib/auth-api";
import {
  loadMfaBackupCodes,
} from "@/lib/mfa-backup-codes-storage";

export function SettingsPage() {
  const { user, displayName, refreshUser, loading: authLoading } = useAuth();
  const { activeSection, setActiveSection } = useSettingsNavigation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { profile: kycProfile, loading: kycProfileLoading } = useSettingsKycProfile(Boolean(user));

  const [backupStatus, setBackupStatus] = useState({
    enrolled: false,
    total: 0,
    remaining: 0,
    used: 0,
  });
  const [storedBackupCodes, setStoredBackupCodes] = useState<string[]>([]);
  const [backupCodesLoading, setBackupCodesLoading] = useState(true);

  const loadBackupCodes = useCallback(async () => {
    if (!user?.id) return;
    setBackupCodesLoading(true);
    try {
      const status = await fetchMfaBackupCodesStatus();
      setBackupStatus(status);
      setStoredBackupCodes(loadMfaBackupCodes(user.id));
    } catch {
      setBackupStatus({ enrolled: false, total: 0, remaining: 0, used: 0 });
    } finally {
      setBackupCodesLoading(false);
    }
  }, [user?.id]);

  const refreshBackupCodesQuietly = useCallback(async () => {
    if (!user?.id) return;
    try {
      const status = await fetchMfaBackupCodesStatus();
      setBackupStatus(status);
      setStoredBackupCodes(loadMfaBackupCodes(user.id));
    } catch {
      setBackupStatus({ enrolled: false, total: 0, remaining: 0, used: 0 });
    }
  }, [user?.id]);

  useEffect(() => {
    const section = searchParams.get("section");
    if (section === "risk-profile") {
      router.replace("/dashboard/risk-profile");
      return;
    }
    if (section && SETTINGS_NAV.some((item) => item.id === section)) {
      setActiveSection(section as SettingsSection);
    }
    if (searchParams.has("section")) {
      router.replace(pathname, { scroll: false });
    }
  }, [pathname, router, searchParams, setActiveSection]);

  const handleSectionChange = useCallback(
    (section: SettingsSection) => {
      setActiveSection(section);
    },
    [setActiveSection],
  );

  useEffect(() => {
    if (activeSection === "mfa") {
      void loadBackupCodes();
    } else {
      setBackupCodesLoading(false);
    }
  }, [activeSection, loadBackupCodes]);

  if (authLoading) {
    return <SettingsPageSkeleton />;
  }

  if (!user) {
    return null;
  }

  const mfaEnabled = user.mfa_enrolled;

  const panelContent = (() => {
    switch (activeSection) {
      case "personal-details":
        return (
          <PersonalDetailsSettingsPanel
            displayName={displayName}
            registeredEmail={user.email}
            phone={user.phone}
            countryCode={user.country_code}
            mfaEnabled={mfaEnabled}
            kycProfile={kycProfile}
            kycProfileLoading={kycProfileLoading}
          />
        );

      case "bank-account":
        return <BankAccountSettingsPanel />;

      case "mfa":
        return (
          <MfaSettingsPanel
            backupStatus={backupStatus}
            backupCodesLoading={backupCodesLoading}
            storedBackupCodes={storedBackupCodes}
            onRefreshBackupCodes={refreshBackupCodesQuietly}
          />
        );

      case "zynd-pin":
        return (
          <ZyndPinSettingsPanel
            mfaEnabled={mfaEnabled}
            pinEnrolled={user.pin_enrolled}
          />
        );

      case "change-password":
        return (
          <ChangePasswordSettingsPanel
            mfaEnabled={mfaEnabled}
            onSessionsRefresh={async () => {}}
          />
        );

      case "change-email":
        return (
          <ChangeEmailSettingsPanel
            currentEmail={user.email}
            mfaEnabled={mfaEnabled}
            onUserRefresh={refreshUser}
            onSessionsRefresh={async () => {}}
          />
        );

      case "your-devices":
        return <YourDevicesSettingsPanel />;

      case "notifications":
        return <NotificationsSettingsPanel />;

      case "delete-account":
        return (
          <DeleteAccountSettingsPanel
            user={user}
            mfaEnabled={mfaEnabled}
            onUserRefresh={refreshUser}
          />
        );

      default:
        return null;
    }
  })();

  const activeSectionMeta =
    SETTINGS_NAV.find((item) => item.id === activeSection) ?? SETTINGS_NAV[0];
  const activeLabel = activeSectionMeta.label;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <DashboardBreadcrumb
        items={[
          { label: "Settings", href: "/dashboard/settings" },
          { label: activeLabel },
        ]}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden md:flex-row">
        <SettingsSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        />

        {activeSection === "personal-details" || activeSection === "bank-account" ? (
          panelContent
        ) : (
          <SettingsContentCard
            header={
              <SettingsPanelHeader
                icon={activeSectionMeta.icon}
                title={activeSectionMeta.title}
                description={activeSectionMeta.description}
                tone={activeSection === "delete-account" ? "destructive" : "default"}
              />
            }
          >
            {panelContent}
          </SettingsContentCard>
        )}
      </div>
    </div>
  );
}
