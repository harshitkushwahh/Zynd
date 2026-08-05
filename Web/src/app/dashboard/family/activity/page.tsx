import { Suspense } from "react";

import { FamilyGroupActivityPage } from "@/features/family-groups/components/family-group-activity-page";
import { FamilyGroupsPageSkeleton } from "@/features/family-groups/components/family-groups-page-skeleton";

export default function DashboardFamilyGroupActivityPage() {
  return (
    <Suspense fallback={<FamilyGroupsPageSkeleton />}>
      <FamilyGroupActivityPage />
    </Suspense>
  );
}
