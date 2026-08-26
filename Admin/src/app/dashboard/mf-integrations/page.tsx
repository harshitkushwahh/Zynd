"use client";

import { Plug } from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminMfIntegrationsSettingsPanel } from "@/components/settings/admin-mf-integrations-settings-panel";

export default function ZyndIntegrationsPage() {
  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Zynd Integrations" }]}
      title="Zynd Integrations"
      icon={Plug}
    >
      <AdminMfIntegrationsSettingsPanel />
    </AdminSectionPageShell>
  );
}
