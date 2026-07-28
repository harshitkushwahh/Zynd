import { BranchCommissionsPanel } from "@/components/dist-management/branch-commissions-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function BranchCommissionsPage() {
  return <BranchCommissionsPanel {...DISTRIBUTOR_PAGE_CONFIG.branchCommissions} />;
}
