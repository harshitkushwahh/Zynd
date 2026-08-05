"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { Settings } from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminMfaPinStatusBadges } from "@/components/settings/admin-mfa-pin-status-badges";
import { AdminSettingsContentCard } from "@/components/settings/admin-settings-content-card";
import { AdminSettingsSidebar } from "@/components/settings/admin-settings-sidebar";
import { AdminChangeEmailSettingsPanel } from "@/components/settings/admin-change-email-settings-panel";
import { AdminChangePasswordSettingsPanel } from "@/components/settings/admin-change-password-settings-panel";
import { AdminDevicesSettingsPanel } from "@/components/settings/admin-devices-settings-panel";
import { AdminInvitationsSettingsPanel } from "@/components/settings/admin-invitations-settings-panel";
import { AdminMfaSettingsPanel } from "@/components/settings/admin-mfa-settings-panel";
import { AdminPreferencesSettingsPanel } from "@/components/settings/admin-preferences-settings-panel";
import { AdminProfileSettingsPanel } from "@/components/settings/admin-profile-settings-panel";
import { AdminTeamSettingsPanel } from "@/components/settings/admin-team-settings-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { fetchAdminSessions } from "@/lib/admin-account-api";
import {
  resolveSettingsSection,
  settingsSectionHref,
  type AdminSettingsSection,
} from "@/lib/admin-settings-navigation";

type AdminSettingsPageProps = {
  sectionSlug?: string;
};

export function AdminSettingsPage({ sectionSlug }: AdminSettingsPageProps) {
  const router = useRouter();
  const { user, hasPermission, refreshUser } = useAdminAuth();

  const activeSection = user
    ? resolveSettingsSection(sectionSlug, hasPermission)
    : null;

  useEffect(() => {
    if (!user || !activeSection) return;
    if (sectionSlug === "mf-integrations") {
      router.replace("/dashboard/mf-integrations");
      return;
    }
    if (sectionSlug === "security-config") {
      router.replace("/dashboard/security-config");
      return;
    }
    if (
      sectionSlug === "roles" ||
      sectionSlug === "permissions" ||
      sectionSlug === "action-types" ||
      sectionSlug === "access-overview"
    ) {
      router.replace(`/dashboard/users/${sectionSlug}`);
      return;
    }
    if (!sectionSlug) {
      router.replace(settingsSectionHref(activeSection.id));
      return;
    }
    if (sectionSlug !== activeSection.id) {
      router.replace(settingsSectionHref(activeSection.id));
    }
  }, [activeSection, router, sectionSlug, user]);

  const refreshSessions = useCallback(async () => {
    await fetchAdminSessions();
  }, []);

  const renderPanel = (section: AdminSettingsSection) => {
    switch (section) {
      case "profile":
        return <AdminProfileSettingsPanel />;
      case "change-password":
        return (
          <AdminChangePasswordSettingsPanel
            mfaEnabled={Boolean(user?.mfa_enrolled)}
            onSessionsRefresh={refreshSessions}
          />
        );
      case "change-email":
        return (
          <AdminChangeEmailSettingsPanel
            currentEmail={user?.email ?? ""}
            mfaEnabled={Boolean(user?.mfa_enrolled)}
            onUserRefresh={refreshUser}
            onSessionsRefresh={refreshSessions}
          />
        );
      case "mfa":
        return <AdminMfaSettingsPanel />;
      case "devices":
        return <AdminDevicesSettingsPanel />;
      case "team":
        return <AdminTeamSettingsPanel />;
      case "invitations":
        return <AdminInvitationsSettingsPanel />;
      case "preferences":
        return <AdminPreferencesSettingsPanel />;
      default:
        return null;
    }
  };

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Administrator" }, { label: "Settings" }]}
      title="Settings"
      icon={Settings}
    >
      {!user ? (
        <AdminFeedbackMessage variant="warning">Sign in to manage settings.</AdminFeedbackMessage>
      ) : !activeSection ? (
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view any settings sections.
        </AdminFeedbackMessage>
      ) : (
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <AdminSettingsSidebar />
          <AdminSettingsContentCard
            title={activeSection.title}
            description={activeSection.description}
            headerAside={
              activeSection.id === "mfa" ? <AdminMfaPinStatusBadges /> : undefined
            }
          >
            {renderPanel(activeSection.id)}
          </AdminSettingsContentCard>
        </div>
      )}
    </AdminSectionPageShell>
  );
}
