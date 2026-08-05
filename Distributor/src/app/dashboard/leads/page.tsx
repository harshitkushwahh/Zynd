import { DistributorLeadsPanel } from "@/components/leads/distributor-leads-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function LeadsPage() {
  return <DistributorLeadsPanel {...DISTRIBUTOR_PAGE_CONFIG.leads} />;
}
