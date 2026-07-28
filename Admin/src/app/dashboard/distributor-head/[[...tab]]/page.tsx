"use client";

import { use } from "react";

import { DistributorHeadPage } from "@/components/distributor-head/distributor-head-page";

type DistributorHeadRoutePageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function DistributorHeadRoutePage({ params }: DistributorHeadRoutePageProps) {
  const { tab } = use(params);
  return <DistributorHeadPage segments={tab} />;
}
