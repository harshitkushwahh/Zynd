"use client";

import { use } from "react";

import { BranchDistributorDetailPage } from "@/components/dist-management/branch-distributor-detail-page";

type BranchDistributorDetailRouteProps = {
  params: Promise<{ distributorId: string }>;
};

export default function BranchDistributorDetailRoute({ params }: BranchDistributorDetailRouteProps) {
  const { distributorId } = use(params);
  return <BranchDistributorDetailPage distributorId={distributorId} />;
}
