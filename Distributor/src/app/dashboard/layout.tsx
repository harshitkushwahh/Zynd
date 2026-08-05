"use client";

import { DistributorShell } from "@/components/distributor-shell";
import { DistributorDashboardShell } from "@/components/dashboard/distributor-dashboard-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DistributorShell>
      <DistributorDashboardShell>{children}</DistributorDashboardShell>
    </DistributorShell>
  );
}
