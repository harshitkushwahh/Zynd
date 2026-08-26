"use client";

import { use } from "react";

import { ReferralsReferrerDetailPage } from "@/components/referrals/referrals-referrer-detail-page";

type ReferralsReferrerRoutePageProps = {
  params: Promise<{ profilePath: string }>;
};

export default function ReferralsReferrerRoutePage({ params }: ReferralsReferrerRoutePageProps) {
  const { profilePath } = use(params);
  return <ReferralsReferrerDetailPage profilePath={profilePath} />;
}
