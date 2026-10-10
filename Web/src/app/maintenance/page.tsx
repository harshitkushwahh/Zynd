"use client";

import { useRouter } from "next/navigation";

import { MaintenanceScreen } from "@/components/maintenance-screen";

export default function MaintenancePage() {
  const router = useRouter();

  return (
    <main className="min-h-dvh">
      <MaintenanceScreen onBackOnline={() => router.replace("/")} />
    </main>
  );
}
