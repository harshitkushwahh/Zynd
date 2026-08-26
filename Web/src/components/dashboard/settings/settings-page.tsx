"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PersonalDetailsSettingsPanel } from "@/components/dashboard/settings/personal-details-settings-panel";
import { BankAccountSettingsPanel } from "@/components/dashboard/settings/bank-account-settings-panel";
import { useSettingsKycProfile } from "@/components/dashboard/settings/use-settings-kyc-profile";
import { ChangeEmailSettingsPanel } from "@/components/dashboard/settings/change-email-settings-panel";
import { ChangePasswordSettingsPanel } from "@/components/dashboard/settings/change-password-settings-panel";
import { DeleteAccountSettingsPanel } from "@/components/dashboard/settings/delete-account-settings-panel";
import { SecuritySettingsPanel } from "@/components/dashboard/settings/security-settings-panel";
import { NotificationsSettingsPanel } from "@/components/dashboard/settings/notifications-settings-panel";
import {
  SettingsSidebar,
  SETTINGS_NAV,
  SETTINGS_SECTION_ALIASES,
  type SettingsSection,
} from "@/components/dashboard/settings/settings-sidebar";
import { SettingsPanelHeader } from "@/components/dashboard/settings/settings-panel-header";
import { SettingsContentCard } from "@/components/dashboard/settings/settings-content-card";
import { YourDevicesSettingsPanel } from "@/components/dashboard/settings/your-devices-settings-panel";
import {
  SettingsPageSkeleton,
} from "@/components/dashboard/settings/settings-skeleton";
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { DashboardContentFade } from "@/components/dashboard/dashboard-content-fade";
import { useAuth } from "@/contexts/auth-context";
import { useSettingsNavigation } from "@/contexts/settings-navigation-context";
import {
  fetchMfaBackupCodesStatus,
} from "@/lib/auth-api";
import {
  loadMfaBackupCodes,
} from "@/lib/mfa-backup-codes-storage";
import { TabPanel } from "@/shared/ui/tab-panel";
import { cn } from "@/lib/utils";

function SettingsSectionPanel({
  section,
  activeSection,
  mounted,
  unwrapped = false,
  children,
}: {
  section: SettingsSection;
  activeSection: SettingsSection;
  mounted: boolean;
  unwrapped?: boolean;
  children: ReactNode;
}) {
  if (!mounted) {
    return null;
  }

  const active = section === activeSection;
  const meta = SETTINGS_NAV.find((item) => item.id === section) ?? SETTINGS_NAV[0];

  if (unwrapped) {
    return (
      <TabPanel active={active} fade className="h-full min-h-0 min-w-0 flex-1">
        {children}
      </TabPanel>
    );
  }

  return (
    <TabPanel
      active={active}
      fade
      className={cn("flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden")}
    >
      <SettingsContentCard
        header={
          <SettingsPanelHeader
            icon={meta.icon}
            title={meta.title}
            description={meta.description}
            tone={section === "delete-account" ? "destructive" : "default"}
          />
        }
      >
        {children}
      </SettingsContentCard>
    </TabPanel>
  );
}

export function SettingsPage() {
  const { user, refreshUser, loading: authLoading } = useAuth();
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
  const [backupCodesLoading, setBackupCodesLoading] = useState(false);
  const [backupCodesHydrated, setBackupCodesHydrated] = useState(false);
  const [autoOpenMfaEnroll, setAutoOpenMfaEnroll] = useState(false);
  const [mountedSections, setMountedSections] = useState<Set<SettingsSection>>(
    () => new Set([activeSection]),
  );

  const loadBackupCodes = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!user?.id) return;
      if (!silent && !backupCodesHydrated) {
        setBackupCodesLoading(true);
      }
      try {
        const status = await fetchMfaBackupCodesStatus();
        setBackupStatus(status);
        setStoredBackupCodes(loadMfaBackupCodes(user.id));
      } catch {
        setBackupStatus({ enrolled: false, total: 0, remaining: 0, used: 0 });
      } finally {
        setBackupCodesLoading(false);
        setBackupCodesHydrated(true);
      }
    },
    [backupCodesHydrated, user?.id],
  );

  const refreshBackupCodesQuietly = useCallback(async () => {
    await loadBackupCodes({ silent: true });
  }, [loadBackupCodes]);

  useEffect(() => {
    const section = searchParams.get("section");
    const action = searchParams.get("action");
    if (section === "risk-profile") {
      router.replace("/dashboard/risk-profile");
      return;
    }
    if (section) {
      const resolved = SETTINGS_SECTION_ALIASES[section] ?? section;
      if (SETTINGS_NAV.some((item) => item.id === resolved)) {
        setActiveSection(resolved as SettingsSection);
      }
    }
    if (action === "enroll-mfa") {
      setActiveSection("security");
      setAutoOpenMfaEnroll(true);
    }
    if (searchParams.has("section") || searchParams.has("action")) {
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
    setMountedSections((current) => {
      if (current.has(activeSection)) {
        return current;
      }
      const next = new Set(current);
      next.add(activeSection);
      return next;
    });
  }, [activeSection]);

  useEffect(() => {
    if (user?.id && user.mfa_enrolled) {
      void loadBackupCodes();
      return;
    }

    setBackupCodesLoading(false);
    setBackupCodesHydrated(false);
    setBackupStatus({ enrolled: false, total: 0, remaining: 0, used: 0 });
    setStoredBackupCodes([]);
  }, [loadBackupCodes, user?.id, user?.mfa_enrolled]);

  if (authLoading) {
    return <SettingsPageSkeleton />;
  }

  if (!user) {
    return null;
  }

  const mfaEnabled = user.mfa_enrolled;
  const isMounted = (section: SettingsSection) => mountedSections.has(section);

  const activeSectionMeta =
    SETTINGS_NAV.find((item) => item.id === activeSection) ?? SETTINGS_NAV[0];
  const activeLabel = activeSectionMeta.label;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="shrink-0">
        <DashboardBreadcrumb
          items={[
            { label: "Settings", href: "/dashboard/settings" },
            { label: activeLabel },
          ]}
        />
      </div>

      <DashboardContentFade className="mt-6 flex min-h-0 flex-1 flex-col gap-6 overflow-hidden md:flex-row md:items-stretch">
        <SettingsSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        />

        <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <SettingsSectionPanel
            section="personal-details"
            activeSection={activeSection}
            mounted={isMounted("personal-details")}
            unwrapped
          >
            <PersonalDetailsSettingsPanel
              registeredEmail={user.email}
              phone={user.phone}
              countryCode={user.country_code}
              mfaEnabled={mfaEnabled}
              kycProfile={kycProfile}
              kycProfileLoading={kycProfileLoading}
            />
          </SettingsSectionPanel>

          <SettingsSectionPanel
            section="bank-account"
            activeSection={activeSection}
            mounted={isMounted("bank-account")}
            unwrapped
          >
            <BankAccountSettingsPanel />
          </SettingsSectionPanel>

          <SettingsSectionPanel
            section="security"
            activeSection={activeSection}
            mounted={isMounted("security")}
          >
            <SecuritySettingsPanel
              backupStatus={backupStatus}
              backupCodesLoading={backupCodesLoading}
              backupCodesHydrated={backupCodesHydrated}
              storedBackupCodes={storedBackupCodes}
              onRefreshBackupCodes={refreshBackupCodesQuietly}
              autoOpenEnroll={autoOpenMfaEnroll}
              onAutoOpenEnrollHandled={() => setAutoOpenMfaEnroll(false)}
              mfaEnabled={mfaEnabled}
              pinEnrolled={user.pin_enrolled}
            />
          </SettingsSectionPanel>

          <SettingsSectionPanel
            section="change-password"
            activeSection={activeSection}
            mounted={isMounted("change-password")}
          >
            <ChangePasswordSettingsPanel
              mfaEnabled={mfaEnabled}
              onSessionsRefresh={async () => {}}
            />
          </SettingsSectionPanel>

          <SettingsSectionPanel
            section="change-email"
            activeSection={activeSection}
            mounted={isMounted("change-email")}
          >
            <ChangeEmailSettingsPanel
              currentEmail={user.email}
              mfaEnabled={mfaEnabled}
              onUserRefresh={refreshUser}
              onSessionsRefresh={async () => {}}
            />
          </SettingsSectionPanel>

          <SettingsSectionPanel
            section="your-devices"
            activeSection={activeSection}
            mounted={isMounted("your-devices")}
          >
            <YourDevicesSettingsPanel />
          </SettingsSectionPanel>

          <SettingsSectionPanel
            section="notifications"
            activeSection={activeSection}
            mounted={isMounted("notifications")}
          >
            <NotificationsSettingsPanel />
          </SettingsSectionPanel>

          <SettingsSectionPanel
            section="delete-account"
            activeSection={activeSection}
            mounted={isMounted("delete-account")}
          >
            <DeleteAccountSettingsPanel
              user={user}
              mfaEnabled={mfaEnabled}
              onUserRefresh={refreshUser}
            />
          </SettingsSectionPanel>
        </div>
      </DashboardContentFade>
    </div>
  );
}
