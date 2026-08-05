import { NotificationsPanel } from "@/components/notifications/notifications-panel";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";

export default function NotificationsPage() {
  return <NotificationsPanel {...DISTRIBUTOR_PAGE_CONFIG.notifications} />;
}
