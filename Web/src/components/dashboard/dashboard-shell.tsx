"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  DashboardMobileNav,
  DashboardSidebar,
} from "@/components/dashboard/dashboard-sidebar";
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar";
import {
  DASHBOARD_INNER_GAP,
  DASHBOARD_MAIN_CONTENT_CLASS,
  DASHBOARD_MAIN_SCROLL_CLASS,
  DASHBOARD_MAIN_TOP_OFFSET,
  DASHBOARD_SHELL_PADDING,
} from "@/components/dashboard/dashboard-layout";
import { cn } from "@/lib/utils";
import { MfPaymentOverlayProvider } from "@/features/invest/contexts/mf-payment-overlay-context";
import { ProfileMenuShortcutListener } from "@/features/dashboard/navigation/profile-menu-shortcut-listener";
import { ZyndPinLockScreen } from "@/features/account/pin";
import { KycDialog } from "@/features/kyc/components/kyc-dialog";
import { SupportFloatingWidget } from "@/features/support/components/support-floating-widget";
import { SupportWidgetProvider } from "@/features/support/contexts/support-widget-context";
import { useZyndPinOptional } from "@/contexts/zynd-pin-context";
import { useKycOptional } from "@/contexts/kyc-context";
import { ZyndGlobalLoader } from "@/components/ui/zynd-global-loader";
import { useAuth } from "@/contexts/auth-context";
import { SettingsNavigationProvider } from "@/contexts/settings-navigation-context";
import { copy } from "@/shared/config/copy";
import { ZyndErrorBoundary } from "@/shared/components/zynd-error-boundary";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, sessionRetrying } = useAuth();
  const pinContext = useZyndPinOptional();
  const kyc = useKycOptional();
  const resumeAfterDigilocker = kyc?.resumeAfterDigilocker;
  const resumeAfterKycSubmission = kyc?.resumeAfterKycSubmission;
  const digilockerReturnHandledRef = useRef(false);
  const kycSubmissionReturnHandledRef = useRef(false);

  useEffect(() => {
    if (!loading && !sessionRetrying && !user) {
      router.replace("/");
    }
  }, [loading, router, sessionRetrying, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    if (params.get("kyc_digilocker_return") === "1") {
      if (!digilockerReturnHandledRef.current && resumeAfterDigilocker) {
        digilockerReturnHandledRef.current = true;
        resumeAfterDigilocker();
      }
      return;
    }

    if (
      params.get("kyc_proof_return") === "1" ||
      params.get("kyc_esign_return") === "1"
    ) {
      if (!kycSubmissionReturnHandledRef.current && resumeAfterKycSubmission) {
        kycSubmissionReturnHandledRef.current = true;
        resumeAfterKycSubmission();
      }
    }
  }, [resumeAfterDigilocker, resumeAfterKycSubmission]);

  const showInitialAuthLoader = loading && !user;
  const showReconnectLoader = sessionRetrying && !user;

  if (showInitialAuthLoader || showReconnectLoader) {
    return (
      <ZyndGlobalLoader
        status={showReconnectLoader ? copy.account.reconnecting : undefined}
      />
    );
  }

  if (!user) {
    return (
      <div className="flex h-dvh items-center justify-center overflow-hidden bg-background p-6">
        <p className="text-compact text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <MfPaymentOverlayProvider>
    <SettingsNavigationProvider>
    <SupportWidgetProvider>
      <ProfileMenuShortcutListener />
    <div className="h-dvh overflow-hidden bg-background">
      {pinContext?.locked ? <ZyndPinLockScreen /> : null}
      {kyc ? (
        <KycDialog
          open={kyc.dialogOpen}
          onOpenChange={(open) => (open ? kyc.openDialog() : kyc.closeDialog())}
        />
      ) : null}
        <div
        className={cn(
          "flex h-full min-h-0 flex-col",
          DASHBOARD_SHELL_PADDING,
          pinContext?.locked && "pointer-events-none select-none blur-sm"
        )}
      >
        <div
          className={cn(
            "flex min-h-0 flex-1 items-stretch",
            DASHBOARD_INNER_GAP,
          )}
        >
          <DashboardSidebar className="hidden md:flex" />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <DashboardNavbar />

            <main
              className={cn(
                DASHBOARD_MAIN_SCROLL_CLASS,
                DASHBOARD_MAIN_TOP_OFFSET,
                "overflow-x-hidden",
              )}
            >
                <div className={DASHBOARD_MAIN_CONTENT_CLASS}>
                  <ZyndErrorBoundary>{children}</ZyndErrorBoundary>
                </div>
              </main>
          </div>
        </div>

        <DashboardMobileNav />
      </div>
      {pinContext?.locked ? null : <SupportFloatingWidget />}
    </div>
    </SupportWidgetProvider>
    </SettingsNavigationProvider>
    </MfPaymentOverlayProvider>
  );
}
