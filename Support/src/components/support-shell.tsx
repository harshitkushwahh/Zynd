"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSupportAuth } from "@/contexts/support-auth-context";

export function SupportShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useSupportAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-compact text-muted-foreground">Loading support console…</p>
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
