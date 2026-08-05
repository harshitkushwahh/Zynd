"use client";

import { Moon, Sun } from "lucide-react";

import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type ThemeTransitionOverlayProps = {
  active: boolean;
  targetTheme: Theme | null;
};

export function ThemeTransitionOverlay({
  active,
  targetTheme,
}: ThemeTransitionOverlayProps) {
  if (!active || !targetTheme) {
    return null;
  }

  const toDark = targetTheme === "dark";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label={toDark ? "Switching to dark mode" : "Switching to light mode"}
    >
      <div className="absolute inset-0 bg-background/35 backdrop-blur-md supports-[backdrop-filter]:bg-background/25 animate-in fade-in-0 duration-500 ease-out" />

      <div
        className={cn(
          "relative flex size-24 items-center justify-center rounded-full border border-border/70 bg-card/90 shadow-zynd-high",
          "animate-in fade-in-0 zoom-in-95 duration-500 ease-out",
        )}
      >
        <Sun
          className={cn(
            "absolute size-11 text-amber-500 transition-all duration-500 ease-out",
            toDark
              ? "scale-75 rotate-45 opacity-0"
              : "scale-100 rotate-0 opacity-100",
          )}
          strokeWidth={1.75}
        />
        <Moon
          className={cn(
            "absolute size-11 text-foreground transition-all duration-500 ease-out",
            toDark
              ? "scale-100 rotate-0 opacity-100"
              : "scale-75 -rotate-45 opacity-0",
          )}
          strokeWidth={1.75}
        />
      </div>
    </div>
  );
}
