"use client";

import { SupportShell } from "@/components/support-shell";
import { SupportDashboardShell } from "@/components/dashboard/support-dashboard-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupportShell>
      <SupportDashboardShell>{children}</SupportDashboardShell>
    </SupportShell>
  );
}
