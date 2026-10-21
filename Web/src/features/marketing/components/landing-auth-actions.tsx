"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthDialogSurface } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { isLandingAuthRestorePending } from "@/features/marketing/lib/landing-auth-restore-pending";
import { useResolvedDisplayName } from "@/shared/hooks/use-resolved-display-name";
import { copy } from "@/shared/config/copy";
import { landingGetStartedButtonClassName } from "@/features/marketing/lib/landing-get-started-button";
import { cn } from "@/lib/utils";

type LandingAuthActionsProps = {
  className?: string;
};

export function LandingAuthActions({ className }: LandingAuthActionsProps) {
  const router = useRouter();
  const { user, loading, sessionRestoring, sessionRetrying } = useAuth();
  const resolvedDisplayName = useResolvedDisplayName();
  const [authOpen, setAuthOpen] = useState(false);

  const restorePending = isLandingAuthRestorePending({
    user,
    loading,
    sessionRestoring,
    sessionRetrying,
  });

  if (restorePending) {
    return (
      <div
        className={cn(
          "h-9 w-24 animate-pulse rounded-full bg-muted/40 dark:bg-white/10",
          className,
        )}
      />
    );
  }

  if (user) {
    const firstName =
      user.first_name?.trim() ||
      resolvedDisplayName.trim().split(/\s+/)[0] ||
      user.email.split("@")[0] ||
      "My";
    const dashboardLabel = `${firstName} Dashboard`;

    return (
      <Button
        size="sm"
        className={cn("gap-1 rounded-full shadow-zynd-mid", className)}
        onClick={() => router.push("/dashboard")}
      >
        {dashboardLabel}
        <ChevronRight className="size-4 shrink-0" aria-hidden />
      </Button>
    );
  }

  return (
    <AuthDialogSurface
      open={authOpen}
      onOpenChange={setAuthOpen}
      triggers={
        <Button
          type="button"
          size="sm"
          className={cn(landingGetStartedButtonClassName, className)}
          onClick={() => setAuthOpen(true)}
        >
          {copy.marketing.navGetStarted}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      }
    />
  );
}
