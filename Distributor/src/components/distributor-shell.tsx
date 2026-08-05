"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DistributorGlobalLoading } from "@/components/auth/distributor-global-loading";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";

export function DistributorShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useDistributorAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return <DistributorGlobalLoading />;
  }

  return <>{children}</>;
}
