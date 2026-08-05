import { DistributorPayrollDetailPanel } from "@/components/payouts/distributor-payroll-detail-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function PayrollHistoryPage() {
  return <DistributorPayrollDetailPanel {...DISTRIBUTOR_PAGE_CONFIG.payrollDetail} />;
}
