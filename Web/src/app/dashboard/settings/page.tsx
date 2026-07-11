import { Suspense } from "react";

import { SettingsPage } from "@/components/dashboard/settings/settings-page";
import { SettingsPageSkeleton } from "@/components/dashboard/settings/settings-skeleton";

export default function DashboardSettingsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Suspense fallback={<SettingsPageSkeleton />}>
        <SettingsPage />
      </Suspense>
    </div>
  );
}
