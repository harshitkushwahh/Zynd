"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DistributorAuthProvider } from "@/contexts/distributor-auth-context";
import { DistributorNotificationsProvider } from "@/contexts/distributor-notifications-context";
import { DistributorTxnRequestsProvider } from "@/contexts/distributor-txn-requests-context";
import { ResidentDistributorAssignmentProvider } from "@/contexts/resident-distributor-assignment-context";
import { ThemeProvider } from "@/contexts/theme-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <DistributorAuthProvider>
          <DistributorTxnRequestsProvider>
            <DistributorNotificationsProvider>
              <ResidentDistributorAssignmentProvider>{children}</ResidentDistributorAssignmentProvider>
            </DistributorNotificationsProvider>
          </DistributorTxnRequestsProvider>
        </DistributorAuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
