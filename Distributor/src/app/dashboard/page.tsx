import { DistributorOverviewPanel } from "@/components/overview/distributor-overview-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function DistributorDashboardIndexPage() {
  return <DistributorOverviewPanel {...DISTRIBUTOR_PAGE_CONFIG.dashboard} />;
}
