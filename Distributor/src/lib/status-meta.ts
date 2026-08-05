import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type {
  InvestorComplianceStatus,
  InvestorInvestmentStatus,
  InvestorOnboardingStatus,
  OrderStatus,
  SystematicPlanStatus,
  TxnRequestStatus,
} from "@/lib/dummy/types";

export function onboardingStatusVariant(
  status: InvestorOnboardingStatus,
): StatusBadgeVariant {
  if (status === "Onboarded") return "success";
  return "warning";
}

export function complianceStatusVariant(
  status: InvestorComplianceStatus,
): StatusBadgeVariant {
  if (status === "Compliant") return "success";
  return "destructive";
}

export function investmentStatusVariant(
  status: InvestorInvestmentStatus,
): StatusBadgeVariant {
  if (status === "Invested") return "info";
  return "neutral";
}

export function orderStatusVariant(status: OrderStatus): StatusBadgeVariant {
  if (status === "Completed") return "success";
  if (status === "Failed") return "destructive";
  if (status === "Processing") return "info";
  return "warning";
}

export function planStatusVariant(status: SystematicPlanStatus): StatusBadgeVariant {
  if (status === "Active") return "success";
  if (status === "Paused") return "warning";
  return "neutral";
}

export function txnRequestStatusVariant(status: TxnRequestStatus): StatusBadgeVariant {
  if (status === "Approved") return "success";
  if (status === "Rejected") return "destructive";
  return "warning";
}
