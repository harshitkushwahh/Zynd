"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ThemeTransitionOverlay } from "@/components/ui/theme-transition-overlay";
import {
  applyTheme,
  persistTheme,
  resolveTheme,
  type Theme,
} from "@/lib/theme";

const APPLY_THEME_MS = 320;
const OVERLAY_TOTAL_MS = 900;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isThemeTransitioning: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [overlayTheme, setOverlayTheme] = useState<Theme | null>(null);
  const [overlayActive, setOverlayActive] = useState(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const resolved = resolveTheme();
    setThemeState(resolved);
    applyTheme(resolved);
    persistTheme(resolved);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const setTheme = useCallback(
    (next: Theme) => {
      if (next === theme || overlayActive) {
        return;
      }

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
        setThemeState(next);
        persistTheme(next);
        applyTheme(next);
        return;
      }

      clearTimers();
      setOverlayTheme(next);
      setOverlayActive(true);

      const applyTimer = window.setTimeout(() => {
        setThemeState(next);
        persistTheme(next);
        applyTheme(next);
      }, APPLY_THEME_MS);

      const hideTimer = window.setTimeout(() => {
        setOverlayActive(false);
        setOverlayTheme(null);
      }, OVERLAY_TOTAL_MS);

      timersRef.current = [applyTimer, hideTimer];
    },
    [clearTimers, overlayActive, theme],
  );

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      isThemeTransitioning: overlayActive,
    }),
    [overlayActive, setTheme, theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <ThemeTransitionOverlay active={overlayActive} targetTheme={overlayTheme} />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
