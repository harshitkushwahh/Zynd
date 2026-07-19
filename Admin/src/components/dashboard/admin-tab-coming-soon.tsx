"use client";

import { AdminEmptyState } from "@/components/dashboard/admin-empty-state";

type AdminTabComingSoonProps = {
  label: string;
  description?: string;
};

export function AdminTabComingSoon({ label, description }: AdminTabComingSoonProps) {
  return <AdminEmptyState variant="coming-soon" label={label} description={description} />;
}
