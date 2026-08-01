import { DistributorLeaveDetailPanel } from "@/components/payouts/distributor-leave-detail-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function LeaveDetailPage() {
  return <DistributorLeaveDetailPanel {...DISTRIBUTOR_PAGE_CONFIG.leaveDetail} />;
}
