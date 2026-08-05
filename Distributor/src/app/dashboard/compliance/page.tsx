import { DistributorCompliancePanel } from "@/components/compliance/distributor-compliance-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function CompliancePage() {
  return <DistributorCompliancePanel {...DISTRIBUTOR_PAGE_CONFIG.compliance} />;
}
