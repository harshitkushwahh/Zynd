"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorChangePasswordSettingsPanel } from "@/components/settings/distributor-change-password-settings-panel";
import { DistributorProfileSettingsPanel } from "@/components/settings/distributor-profile-settings-panel";
import { DistributorSecuritySettingsPanel } from "@/components/settings/distributor-security-settings-panel";
import { DistributorSettingsContentCard } from "@/components/settings/distributor-settings-content-card";
import { DistributorSettingsNotificationsPanel } from "@/components/settings/distributor-settings-notifications-panel";
import { DistributorSettingsSectionHeaderHelp } from "@/components/settings/distributor-settings-section-header-help";
import { DistributorSettingsSidebar } from "@/components/settings/distributor-settings-sidebar";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import {
  distributorSettingsSectionHref,
  resolveDistributorSettingsSection,
  type DistributorSettingsSection,
} from "@/lib/distributor-settings-navigation";
import {
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_SETTINGS_LAYOUT_CLASS,
} from "@/lib/distributor-layout";

type DistributorSettingsPanelProps = {
  title: string;
  description: string;
  sectionSlug?: string;
};

function renderSettingsPanel(section: DistributorSettingsSection) {
  switch (section) {
    case "profile":
      return <DistributorProfileSettingsPanel />;
    case "change-password":
      return <DistributorChangePasswordSettingsPanel />;
    case "security":
      return <DistributorSecuritySettingsPanel />;
    case "notifications":
      return <DistributorSettingsNotificationsPanel />;
    default:
      return null;
  }
}

export function DistributorSettingsPanel({
  title,
  description,
  sectionSlug,
}: DistributorSettingsPanelProps) {
  const router = useRouter();
  const { user } = useDistributorAuth();
  const activeSection = resolveDistributorSettingsSection(sectionSlug);

  useEffect(() => {
    if (!user) return;
    if (!sectionSlug) {
      router.replace(distributorSettingsSectionHref(activeSection.id));
      return;
    }
    if (sectionSlug !== activeSection.id) {
      router.replace(distributorSettingsSectionHref(activeSection.id));
    }
  }, [activeSection.id, router, sectionSlug, user]);

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title={title} description={description} />

      {!user ? (
        <p className="text-compact text-muted-foreground">Sign in to manage settings.</p>
      ) : (
        <div className={DISTRIBUTOR_SETTINGS_LAYOUT_CLASS}>
          <DistributorSettingsSidebar />
          <DistributorSettingsContentCard
            title={activeSection.title}
            description={activeSection.description}
            headerAside={<DistributorSettingsSectionHeaderHelp section={activeSection.id} />}
          >
            {renderSettingsPanel(activeSection.id)}
          </DistributorSettingsContentCard>
        </div>
      )}
    </div>
  );
}
