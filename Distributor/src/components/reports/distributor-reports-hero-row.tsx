"use client";

import { DistributorReportsNetSalesHyperCard } from "@/components/reports/distributor-reports-net-sales-hyper-card";
import { DistributorReportsSectionMetrics } from "@/components/reports/distributor-reports-section-metrics";

export function DistributorReportsHeroRow() {
  return (
    <div className="distributor-reports-hero-row">
      <DistributorReportsSectionMetrics className="distributor-reports-hero-row__metrics" />
      <div className="distributor-reports-hero-row__hyper">
        <DistributorReportsNetSalesHyperCard />
      </div>
    </div>
  );
}
