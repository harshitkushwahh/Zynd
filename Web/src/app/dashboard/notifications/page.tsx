import { Suspense } from "react";

import { NotificationsPagePanel } from "@/features/notifications/components/notifications-page-panel";
import { NotificationsPageSkeleton } from "@/features/notifications/components/notifications-page-skeleton";

export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsPageSkeleton />}>
      <NotificationsPagePanel />
    </Suspense>
  );
}
