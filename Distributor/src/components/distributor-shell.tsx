"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DistributorGlobalLoading } from "@/components/auth/distributor-global-loading";
import { DistributorZyndPinLockScreen } from "@/components/auth/distributor-zynd-pin-lock-screen";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { useDistributorZyndPinOptional } from "@/contexts/distributor-zynd-pin-context";

export function DistributorShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useDistributorAuth();
  const pinContext = useDistributorZyndPinOptional();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return <DistributorGlobalLoading />;
  }

  return (
    <>
      {children}
      {pinContext?.locked ? <DistributorZyndPinLockScreen /> : null}
    </>
  );
}
