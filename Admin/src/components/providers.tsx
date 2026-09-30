"use client";

import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminQueryProvider } from "@/components/providers/admin-query-provider";
import { AdminAuthProvider } from "@/contexts/admin-auth-context";
import { AdminZyndPinProvider } from "@/contexts/admin-zynd-pin-context";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";

function AdminToaster() {
  const { theme } = useTheme();
  return <Toaster position="top-right" theme={theme} richColors closeButton />;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <AdminAuthProvider>
          <AdminQueryProvider>
            <AdminZyndPinProvider>
              {children}
              <AdminToaster />
            </AdminZyndPinProvider>
          </AdminQueryProvider>
        </AdminAuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
