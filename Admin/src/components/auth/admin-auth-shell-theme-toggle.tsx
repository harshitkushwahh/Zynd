"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/contexts/theme-context";

export function AdminAuthShellThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="admin-auth-shell-theme-toggle">
      <ThemeToggle theme={theme} onThemeChange={setTheme} variant="icon" />
    </div>
  );
}
