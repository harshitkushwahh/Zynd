"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useDistributorAuth } from "@/contexts/distributor-auth-context";

export function DistributorShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useDistributorAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-compact text-muted-foreground">Loading distributor console…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-compact text-muted-foreground">Redirecting…</p>
      </div>
    );
  }

  return <>{children}</>;
}
