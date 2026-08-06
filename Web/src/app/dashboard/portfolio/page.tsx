import { Suspense } from "react";

import { PortfolioPage } from "@/features/dashboard/portfolio/components/portfolio-page";

export default function DashboardPortfolioPage() {
  return (
    <Suspense fallback={null}>
      <PortfolioPage />
    </Suspense>
  );
}
