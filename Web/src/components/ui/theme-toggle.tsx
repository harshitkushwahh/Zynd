"use client";

import { ThemeSwitchVisual } from "@/components/ui/theme-switch-visual";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  className?: string;
};

export function ThemeToggle({ theme, onThemeChange, className }: ThemeToggleProps) {
  const isDark = theme === "dark";

  return (
    <ThemeSwitchVisual
      checked={isDark}
      interactive
      className={className}
      ariaLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onCheckedChange={(checked) => onThemeChange(checked ? "dark" : "light")}
    />
  );
}
