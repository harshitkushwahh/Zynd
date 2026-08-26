"use client";

import { use } from "react";

import { ReferralsPage } from "@/components/referrals/referrals-page";

type ReferralsRoutePageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function ReferralsRoutePage({ params }: ReferralsRoutePageProps) {
  const { tab } = use(params);
  return <ReferralsPage tabSlug={tab?.[0]} />;
}
