"use client";

import { markBackendConnectionReady } from "@/lib/api-client";
import { MaintenanceScreen } from "@/components/maintenance-screen";

type BackendConnectionDialogProps = {
  open: boolean;
};

export function BackendConnectionDialog({ open }: BackendConnectionDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="zynd-maintenance-title"
    >
      <MaintenanceScreen
        onBackOnline={() => {
          markBackendConnectionReady();
          window.location.reload();
        }}
      />
    </div>
  );
}
