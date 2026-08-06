import { Suspense } from "react";

import { PortfolioHoldingDetailPage } from "@/features/dashboard/portfolio/components/portfolio-holding-detail-page";

type DashboardPortfolioHoldingPageProps = {
  params: Promise<{ holdingId: string }>;
};

export default async function DashboardPortfolioHoldingPage({
  params,
}: DashboardPortfolioHoldingPageProps) {
  const { holdingId } = await params;
  return (
    <Suspense fallback={null}>
      <PortfolioHoldingDetailPage holdingId={holdingId} />
    </Suspense>
  );
}
