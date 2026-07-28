import { BranchReportsPanel } from "@/components/dist-management/branch-reports-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function BranchReportsPage() {
  return <BranchReportsPanel {...DISTRIBUTOR_PAGE_CONFIG.branchReports} />;
}
