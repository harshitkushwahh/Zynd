"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/contexts/theme-context";

export function SupportAuthShellThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="support-auth-shell-theme-toggle">
      <ThemeToggle theme={theme} onThemeChange={setTheme} />
    </div>
  );
}
