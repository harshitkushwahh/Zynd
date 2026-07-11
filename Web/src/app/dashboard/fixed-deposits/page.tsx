import { DashboardSectionPlaceholder } from "@/features/dashboard/components/dashboard-section-placeholder";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";

const route = DASHBOARD_ROUTES.find((item) => item.id === "fixed-deposits")!;

export default function FixedDepositsPage() {
  return <DashboardSectionPlaceholder route={route} />;
}
