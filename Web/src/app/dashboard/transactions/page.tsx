import { DashboardSectionPlaceholder } from "@/features/dashboard/components/dashboard-section-placeholder";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";

const route = DASHBOARD_ROUTES.find((item) => item.id === "transactions")!;

export default function TransactionsPage() {
  return <DashboardSectionPlaceholder route={route} />;
}
