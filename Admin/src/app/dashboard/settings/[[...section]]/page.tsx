"use client";

import { use } from "react";

import { AdminSettingsPage } from "@/components/settings/admin-settings-page";

type SettingsRoutePageProps = {
  params: Promise<{ section?: string[] }>;
};

export default function SettingsRoutePage({ params }: SettingsRoutePageProps) {
  const { section } = use(params);
  return <AdminSettingsPage sectionSlug={section?.[0]} />;
}
