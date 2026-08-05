"use client";

import { use } from "react";

import { FamilyGroupsPage } from "@/components/family-groups/family-groups-page";

type FamilyGroupsRoutePageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function FamilyGroupsRoutePage({ params }: FamilyGroupsRoutePageProps) {
  const { tab } = use(params);
  return <FamilyGroupsPage tabSlug={tab?.[0]} />;
}
