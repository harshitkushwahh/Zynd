"use client";

import { Suspense } from "react";

import { AuthProvider } from "@/contexts/auth-context";
import { KycProvider } from "@/contexts/kyc-context";
import { NotificationProvider } from "@/contexts/notification-context";
import { ProfileImageProvider } from "@/contexts/profile-image-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { ZyndPinProvider } from "@/contexts/zynd-pin-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { NotificationDeepLinkHandler } from "@/features/notifications/components/notification-deep-link-handler";
import { PushDeviceRegistration } from "@/features/notifications/components/web-push-bridge";
import { ReferralAttributionCapture } from "@/features/referral/components/referral-attribution-capture";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delay={200}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <ProfileImageProvider>
              <KycProvider>
                <ZyndPinProvider>
                  <PushDeviceRegistration />
                  <Suspense fallback={null}>
                    <ReferralAttributionCapture />
                    <NotificationDeepLinkHandler />
                  </Suspense>
                  {children}
                  <Toaster position="top-right" offset={{ top: "1rem", right: "1rem" }} />
                </ZyndPinProvider>
              </KycProvider>
            </ProfileImageProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  );
}
