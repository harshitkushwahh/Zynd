"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminQueryProvider } from "@/components/providers/admin-query-provider";
import { AdminAuthProvider } from "@/contexts/admin-auth-context";
import { AdminZyndPinProvider } from "@/contexts/admin-zynd-pin-context";
import { ThemeProvider } from "@/contexts/theme-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <AdminAuthProvider>
          <AdminQueryProvider>
            <AdminZyndPinProvider>{children}</AdminZyndPinProvider>
          </AdminQueryProvider>
        </AdminAuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
