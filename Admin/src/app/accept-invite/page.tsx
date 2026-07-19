"use client";

import { Suspense } from "react";

import { AdminInviteOnboardingPage } from "@/components/auth/admin-invite-onboarding-page";

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="admin-login-shell flex min-h-full flex-1 items-center justify-center px-4 py-10">
          <p className="text-caption text-muted-foreground">Opening your invitation…</p>
        </div>
      }
    >
      <AdminInviteOnboardingPage />
    </Suspense>
  );
}
