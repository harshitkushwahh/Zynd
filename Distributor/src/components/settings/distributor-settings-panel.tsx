"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Info } from "lucide-react";

import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { resolveDistributorPageIcon } from "@/components/dashboard/distributor-page-icons";
import type { DistributorPageIconName } from "@/components/dashboard/distributor-page-icons";
import { DistributorChangePasswordSettingsPanel } from "@/components/settings/distributor-change-password-settings-panel";
import { DistributorProfileSettingsPanel } from "@/components/settings/distributor-profile-settings-panel";
import { DistributorSecuritySettingsPanel } from "@/components/settings/distributor-security-settings-panel";
import { DistributorSettingsContentCard } from "@/components/settings/distributor-settings-content-card";
import { DistributorSettingsNotificationsPanel } from "@/components/settings/distributor-settings-notifications-panel";
import { DistributorSettingsSidebar } from "@/components/settings/distributor-settings-sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  iconName: DistributorPageIconName;
  title: string;
  description: string;
  sectionSlug?: string;
};

const PROFILE_UPDATE_HELP =
  "To update distributor details or replace documents, contact your Zynd administrator.";

function ProfileSettingsHeaderHelp() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Profile update policy"
          >
            <Info className="size-4" strokeWidth={2.25} />
          </Button>
        }
      />
      <TooltipContent side="left" align="end" className="max-w-xs text-left leading-snug">
        {PROFILE_UPDATE_HELP}
      </TooltipContent>
    </Tooltip>
  );
}

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
  iconName,
  title,
  description,
  sectionSlug,
}: DistributorSettingsPanelProps) {
  const router = useRouter();
  const { user } = useDistributorAuth();
  const Icon = resolveDistributorPageIcon(iconName);
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
      <DistributorPageHeader icon={Icon} title={title} description={description} />

      {!user ? (
        <p className="text-compact text-muted-foreground">Sign in to manage settings.</p>
      ) : (
        <div className={DISTRIBUTOR_SETTINGS_LAYOUT_CLASS}>
          <DistributorSettingsSidebar />
          <DistributorSettingsContentCard
            title={activeSection.title}
            description={activeSection.description}
            headerAside={
              activeSection.id === "profile" ? <ProfileSettingsHeaderHelp /> : undefined
            }
          >
            {renderSettingsPanel(activeSection.id)}
          </DistributorSettingsContentCard>
        </div>
      )}
    </div>
  );
}
