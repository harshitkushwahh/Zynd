import { BranchTeamPerformancePanel } from "@/components/dist-management/branch-team-performance-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function BranchPerformancePage() {
  return <BranchTeamPerformancePanel {...DISTRIBUTOR_PAGE_CONFIG.branchPerformance} />;
}
