import { OrdersPanel } from "@/components/orders/orders-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function OrdersPage() {
  return <OrdersPanel {...DISTRIBUTOR_PAGE_CONFIG.orders} />;
}
