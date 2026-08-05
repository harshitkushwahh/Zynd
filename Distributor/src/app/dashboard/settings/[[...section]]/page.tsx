"use client";

import { use } from "react";

import { DistributorSettingsPanel } from "@/components/settings/distributor-settings-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

type SettingsRoutePageProps = {
  params: Promise<{ section?: string[] }>;
};

export default function DistributorSettingsRoutePage({ params }: SettingsRoutePageProps) {
  const { section } = use(params);
  return (
    <DistributorSettingsPanel
      {...DISTRIBUTOR_PAGE_CONFIG.settings}
      sectionSlug={section?.[0]}
    />
  );
}
