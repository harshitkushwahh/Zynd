import { DistributorJobDashboardPanel } from "@/components/payouts/distributor-job-dashboard-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function PayoutsPage() {
  return <DistributorJobDashboardPanel {...DISTRIBUTOR_PAGE_CONFIG.payouts} />;
}
