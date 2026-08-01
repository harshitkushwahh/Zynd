import { Suspense } from "react";

import { DistManagementHubPage } from "@/components/dist-management/dist-management-hub-page";
import { DistManagementHubPageSkeleton } from "@/components/dist-management/dist-management-hub-page-skeleton";

export default function DistManagementHubRoute() {
  return (
    <Suspense fallback={<DistManagementHubPageSkeleton />}>
      <DistManagementHubPage />
    </Suspense>
  );
}
