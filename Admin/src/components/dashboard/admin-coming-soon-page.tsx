"use client";

import { Construction } from "lucide-react";

import { AdminEmptyState } from "@/components/dashboard/admin-empty-state";
import { AdminPageHeader } from "@/components/dashboard/admin-page-header";
import { ADMIN_NAV_ROUTES } from "@/lib/admin-navigation";

type AdminComingSoonPageProps = {
  routeId: string;
};

export function AdminComingSoonPage({ routeId }: AdminComingSoonPageProps) {
  const route = ADMIN_NAV_ROUTES.find((item) => item.id === routeId);
  if (!route) return null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={route.label}
        description={route.description}
        icon={route.icon}
      />
      <AdminEmptyState
        variant="coming-soon"
        label={route.label}
        title="This area is under development"
        description={
          route.description ??
          `${route.label} will be available in a future release of the admin console.`
        }
      />
    </div>
  );
}
