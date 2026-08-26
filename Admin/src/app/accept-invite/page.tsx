"use client";

import { Suspense } from "react";

import { AdminInviteOnboardingPage } from "@/components/auth/admin-invite-onboarding-page";

export default function AcceptInvitePage() {
  return (
    <div className="admin-login-shell min-h-dvh w-full">
      <Suspense
        fallback={
          <div className="flex min-h-dvh w-full items-center justify-center px-4 py-10">
            <p className="text-caption text-muted-foreground">Opening your invitation…</p>
          </div>
        }
      >
        <AdminInviteOnboardingPage />
      </Suspense>
    </div>
  );
}
