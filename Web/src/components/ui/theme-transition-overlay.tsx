"use client";

import { useEffect, useState } from "react";

import { ThemeTransitionOrb } from "@/components/ui/theme-sun-moon-art";
import type { Theme } from "@/lib/theme";

type ThemeTransitionOverlayProps = {
  active: boolean;
  targetTheme: Theme | null;
};

export function ThemeTransitionOverlay({
  active,
  targetTheme,
}: ThemeTransitionOverlayProps) {
  const toDark = targetTheme === "dark";
  const [orbDark, setOrbDark] = useState(!toDark);

  useEffect(() => {
    if (!active || !targetTheme) return;

    setOrbDark(!toDark);
    const frame = window.requestAnimationFrame(() => {
      setOrbDark(toDark);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [active, targetTheme, toDark]);

  if (!active || !targetTheme) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label={toDark ? "Switching to dark mode" : "Switching to light mode"}
    >
      <div className="absolute inset-0 bg-background/35 backdrop-blur-md supports-[backdrop-filter]:bg-background/25 animate-in fade-in-0 duration-500 ease-out" />

      <div className="relative animate-in fade-in-0 zoom-in-95 duration-500 ease-out">
        <ThemeTransitionOrb isDark={orbDark} />
      </div>
    </div>
  );
}
