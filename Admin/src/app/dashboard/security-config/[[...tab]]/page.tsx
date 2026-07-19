"use client";

import { use } from "react";

import { AdminSecurityConfigPage } from "@/components/settings/admin-security-config-page";

type SecurityConfigRoutePageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function SecurityConfigRoutePage({ params }: SecurityConfigRoutePageProps) {
  const { tab } = use(params);
  return <AdminSecurityConfigPage tabSlug={tab?.[0]} />;
}
