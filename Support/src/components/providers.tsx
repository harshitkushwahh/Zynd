"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SupportAuthProvider } from "@/contexts/support-auth-context";
import { ThemeProvider } from "@/contexts/theme-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <SupportAuthProvider>{children}</SupportAuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
