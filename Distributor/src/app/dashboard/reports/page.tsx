import { DistributorReportsPanel } from "@/components/reports/distributor-reports-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function ReportsPage() {
  return <DistributorReportsPanel {...DISTRIBUTOR_PAGE_CONFIG.reports} />;
}
