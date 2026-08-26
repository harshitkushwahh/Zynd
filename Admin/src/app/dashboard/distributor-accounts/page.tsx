"use client";

import { ArrowUpRight } from "lucide-react";

import { AdminComingSoonPage } from "@/components/dashboard/admin-coming-soon-page";
import { AdminPageHeader } from "@/components/dashboard/admin-page-header";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { ADMIN_NAV_ROUTES } from "@/lib/admin-navigation";

export default function MitraConsoleRedirectPage() {
  const route = ADMIN_NAV_ROUTES.find((item) => item.id === "mitra-console");

  if (!env.distributorUrl || !route) {
    return <AdminComingSoonPage routeId="mitra-console" />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title={route.label} icon={route.icon} />
      <div className="rounded-xl border border-border/80 bg-card p-6">
        <p className="text-compact text-muted-foreground">
          Open the Mitra field console in a new tab to manage branch managers and Zynd Mitras.
        </p>
        <Button asChild className="mt-4">
          <a
            href={env.distributorUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Mitra console
            <ArrowUpRight className="size-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
