"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminAuthProvider } from "@/contexts/admin-auth-context";
import { AdminZyndPinProvider } from "@/contexts/admin-zynd-pin-context";
import { ThemeProvider } from "@/contexts/theme-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <AdminAuthProvider>
          <AdminZyndPinProvider>{children}</AdminZyndPinProvider>
        </AdminAuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
