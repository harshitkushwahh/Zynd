"use client";

import { AdminShell } from "@/components/admin-shell";
import { AdminDashboardShell } from "@/components/dashboard/admin-dashboard-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell>
      <AdminDashboardShell>{children}</AdminDashboardShell>
    </AdminShell>
  );
}
