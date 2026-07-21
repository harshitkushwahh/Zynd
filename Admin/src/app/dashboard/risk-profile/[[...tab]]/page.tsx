"use client";

import { use } from "react";

import { RiskProfilePage } from "@/components/risk-profile/risk-profile-page";

type RiskProfileRoutePageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function RiskProfileRoutePage({ params }: RiskProfileRoutePageProps) {
  const { tab } = use(params);
  return <RiskProfilePage tabSlug={tab?.[0]} />;
}
