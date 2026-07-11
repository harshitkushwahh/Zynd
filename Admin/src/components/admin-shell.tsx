"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AdminZyndPinLockScreen } from "@/components/admin-zynd-pin-lock-screen";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { useAdminZyndPinOptional } from "@/contexts/admin-zynd-pin-context";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAdminAuth();
  const pinContext = useAdminZyndPinOptional();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <p className="text-compact text-muted-foreground">Loading console...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <p className="text-compact text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <>
      {pinContext?.locked ? <AdminZyndPinLockScreen /> : null}
      {children}
    </>
  );
}
