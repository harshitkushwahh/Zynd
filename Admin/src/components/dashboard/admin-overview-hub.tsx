"use client";

import { useAdminAuth } from "@/contexts/admin-auth-context";

export function AdminOverviewHub() {
  const { user, displayName } = useAdminAuth();

  return (
    <div>
      <p className="text-compact font-medium text-primary">Platform Console</p>
      <h1 className="mt-1 font-heading text-h2 font-bold text-foreground">
        Welcome, {displayName}
      </h1>
      <p className="mt-2 text-compact text-muted-foreground">
        Signed in as {user?.email}
      </p>
    </div>
  );
}
