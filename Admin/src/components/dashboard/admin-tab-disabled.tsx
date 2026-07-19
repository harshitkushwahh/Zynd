"use client";

import { AdminEmptyState } from "@/components/dashboard/admin-empty-state";

type AdminTabDisabledProps = {
  label: string;
  description?: string;
};

export function AdminTabDisabled({ label, description }: AdminTabDisabledProps) {
  return <AdminEmptyState variant="disabled" label={label} description={description} />;
}
