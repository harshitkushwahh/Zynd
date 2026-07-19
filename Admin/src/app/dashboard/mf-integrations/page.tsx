"use client";

import { Plug } from "lucide-react";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AdminMfIntegrationsSettingsPanel } from "@/components/settings/admin-mf-integrations-settings-panel";
import { ADMIN_NAV_ROUTES } from "@/lib/admin-navigation";

const integrationsRoute = ADMIN_NAV_ROUTES.find((route) => route.id === "mf-integrations");

export default function ZyndIntegrationsPage() {
  return (
    <div className="space-y-6">
      <AdminSectionTitle
        icon={Plug}
        description={integrationsRoute?.description}
      >
        Zynd Integrations
      </AdminSectionTitle>
      <AdminMfIntegrationsSettingsPanel />
    </div>
  );
}
