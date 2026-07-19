"use client";

import { use } from "react";

import { SystematicPlansSectionPage } from "@/components/mf/systematic-plans-section-page";

type SystematicPlansPageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function SystematicPlansPage({ params }: SystematicPlansPageProps) {
  const { tab } = use(params);
  return <SystematicPlansSectionPage tabSlug={tab?.[0]} />;
}
