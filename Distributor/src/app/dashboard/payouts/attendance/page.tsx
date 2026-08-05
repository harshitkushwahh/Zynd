import { DistributorWorkAttendanceDetailPanel } from "@/components/payouts/distributor-work-attendance-detail-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function WorkAttendancePage() {
  return <DistributorWorkAttendanceDetailPanel {...DISTRIBUTOR_PAGE_CONFIG.attendanceDetail} />;
}
