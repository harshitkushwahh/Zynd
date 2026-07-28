import { BranchDistributorsPanel } from "@/components/dist-management/branch-distributors-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function BranchDistributorsPage() {
  return <BranchDistributorsPanel {...DISTRIBUTOR_PAGE_CONFIG.branchDistributors} />;
}
