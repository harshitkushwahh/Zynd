"use client";

import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  className?: string;
  variant?: "switch" | "icon";
};

export function ThemeToggle({
  theme,
  onThemeChange,
  className,
  variant = "switch",
}: ThemeToggleProps) {
  const isDark = theme === "dark";

  if (variant === "icon") {
    const Icon = isDark ? Moon : Sun;

    return (
      <button
        type="button"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => onThemeChange(isDark ? "light" : "dark")}
        className={cn(
          "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card/80 text-foreground shadow-zynd-low backdrop-blur-sm transition-colors hover:bg-muted/55 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          className,
        )}
      >
        <Icon className="size-4" strokeWidth={2.25} />
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => onThemeChange(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-9 w-theme-toggle shrink-0 cursor-pointer items-center rounded-full bg-transparent p-1 transition-colors hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1 left-1 size-7 rounded-full bg-background shadow-zynd-low transition-transform duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]",
          isDark ? "translate-x-9" : "translate-x-0",
        )}
      />
      <span className="relative z-10 flex w-full items-center justify-between px-2">
        <Sun
          className={cn(
            "size-4 transition-all duration-300",
            isDark ? "text-muted-foreground/45" : "text-foreground",
          )}
          strokeWidth={2.25}
        />
        <Moon
          className={cn(
            "size-4 transition-all duration-300",
            isDark ? "text-foreground" : "text-muted-foreground/45",
          )}
          strokeWidth={2.25}
        />
      </span>
    </button>
  );
}
