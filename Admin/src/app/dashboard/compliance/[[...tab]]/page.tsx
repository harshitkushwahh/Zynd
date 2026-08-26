"use client";

import { use } from "react";

import { CompliancePage } from "@/components/compliance/compliance-page";

type ComplianceRoutePageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function ComplianceRoutePage({ params }: ComplianceRoutePageProps) {
  const { tab } = use(params);
  return <CompliancePage tabSlug={tab?.[0]} />;
}
