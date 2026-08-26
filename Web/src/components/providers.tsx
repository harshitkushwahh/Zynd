"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";

import { AuthProvider } from "@/contexts/auth-context";
import { BackendConnectionProvider } from "@/contexts/backend-connection-context";
import { KycProvider } from "@/contexts/kyc-context";
import { RiskProfileProvider } from "@/contexts/risk-profile-context";
import { NotificationProvider } from "@/contexts/notification-context";
import { ProfileImageProvider } from "@/contexts/profile-image-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { ZyndPinProvider } from "@/contexts/zynd-pin-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { NotificationDeepLinkHandler } from "@/features/notifications/components/notification-deep-link-handler";
import { PushDeviceRegistration } from "@/features/notifications/components/web-push-bridge";
import { ReferralAttributionCapture } from "@/features/referral/components/referral-attribution-capture";
import { FamilyInviteCapture } from "@/features/family-groups/components/family-invite-capture";
import { FamilyInviteHandler } from "@/features/family-groups/hooks/use-family-invite-handler";
import { DocumentTitleSync } from "@/components/document-title-sync";
import { getQueryClient } from "@/lib/query-client";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <TooltipProvider delay={200}>
      <ThemeProvider>
        <BackendConnectionProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <NotificationProvider>
                <ProfileImageProvider>
                  <KycProvider>
                    <RiskProfileProvider>
                      <ZyndPinProvider>
                        <PushDeviceRegistration />
                        <Suspense fallback={null}>
                          <DocumentTitleSync />
                          <ReferralAttributionCapture />
                          <FamilyInviteCapture />
                          <FamilyInviteHandler />
                          <NotificationDeepLinkHandler />
                        </Suspense>
                        {children}
                        <Toaster position="top-right" offset={{ top: "1rem", right: "1rem" }} />
                      </ZyndPinProvider>
                    </RiskProfileProvider>
                  </KycProvider>
                </ProfileImageProvider>
              </NotificationProvider>
            </QueryClientProvider>
          </AuthProvider>
        </BackendConnectionProvider>
      </ThemeProvider>
    </TooltipProvider>
  );
}
