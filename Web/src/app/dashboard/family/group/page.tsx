import { Suspense } from "react";

import { FamilyGroupDetailPage } from "@/features/family-groups/components/family-group-detail-page";
import { FamilyGroupsPageSkeleton } from "@/features/family-groups/components/family-groups-page-skeleton";

export default function DashboardFamilyGroupDetailPage() {
  return (
    <Suspense fallback={<FamilyGroupsPageSkeleton />}>
      <FamilyGroupDetailPage />
    </Suspense>
  );
}
