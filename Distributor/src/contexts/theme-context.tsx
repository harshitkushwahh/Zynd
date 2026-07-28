"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ThemeTransitionOverlay } from "@/components/ui/theme-transition-overlay";
import {
  applyTheme,
  persistTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

const APPLY_THEME_MS = 320;
const OVERLAY_TOTAL_MS = 900;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isThemeTransitioning: boolean;
  pendingTheme: Theme | null;
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

  useLayoutEffect(() => {
    const resolved = resolveTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with beforeInteractive theme script
    setThemeState(resolved);
    applyTheme(resolved);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const resolved = resolveTheme();
      setThemeState(resolved);
      applyTheme(resolved);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
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
      pendingTheme: overlayTheme,
    }),
    [overlayActive, overlayTheme, setTheme, theme],
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
