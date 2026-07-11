"use client";

import { AdminAuthProvider } from "@/contexts/admin-auth-context";
import { AdminZyndPinProvider } from "@/contexts/admin-zynd-pin-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminZyndPinProvider>{children}</AdminZyndPinProvider>
    </AdminAuthProvider>
  );
}
