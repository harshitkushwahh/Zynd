"use client";

import { Mail, Users } from "lucide-react";

import { AdminInvitationsSettingsPanel } from "@/components/settings/admin-invitations-settings-panel";
import { AdminTeamSettingsPanel } from "@/components/settings/admin-team-settings-panel";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import {
  TEAM_WORKSPACE_SUB_TABS,
  type TeamWorkspaceSubTabKey,
} from "@/lib/admin-user-management-navigation";

const SUB_TAB_ICONS = {
  members: Users,
  invitations: Mail,
} as const;

type AdminTeamWorkspacePanelProps = {
  activeSubTab: TeamWorkspaceSubTabKey;
  onSubTabChange: (subTab: TeamWorkspaceSubTabKey) => void;
};

function TeamWorkspaceSubTabList() {
  return (
    <AdminTabList variant="secondary" className="max-w-full shrink-0 overflow-x-auto">
      {TEAM_WORKSPACE_SUB_TABS.map((tab) => {
        const Icon = SUB_TAB_ICONS[tab.key];
        return (
          <AdminTabTrigger key={tab.key} value={tab.key} className="gap-2">
            <Icon className="size-4 shrink-0" />
            {tab.label}
          </AdminTabTrigger>
        );
      })}
    </AdminTabList>
  );
}

export function AdminTeamWorkspacePanel({
  activeSubTab,
  onSubTabChange,
}: AdminTeamWorkspacePanelProps) {
  const { activeTab, selectTab, keepMounted } = useMountedTabs<TeamWorkspaceSubTabKey>(
    activeSubTab,
    activeSubTab,
  );

  const subTabs = <TeamWorkspaceSubTabList />;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        const nextTab = value as TeamWorkspaceSubTabKey;
        selectTab(nextTab);
        onSubTabChange(nextTab);
      }}
      className="gap-4"
    >
      <TabsContent value="members" className="mt-0" keepMounted={keepMounted("members")}>
        <AdminTeamSettingsPanel trailingToolbar={subTabs} />
      </TabsContent>
      <TabsContent value="invitations" className="mt-0" keepMounted={keepMounted("invitations")}>
        <AdminInvitationsSettingsPanel trailingToolbar={subTabs} />
      </TabsContent>
    </Tabs>
  );
}
