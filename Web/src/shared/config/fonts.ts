import { Inter } from "next/font/google";

/** CSS variable wired to `--font-sans` in `styles/zynd-brand.css`. */
export const sansFontVariable = "--font-inter" as const;

/**
 * Global sans weights. Must match the literal `weight` array in `interSans` —
 * Next.js font loader only accepts compile-time literals, not variables.
 */
export const sansFontWeights = ["300", "400", "500", "600", "700"] as const;

export const interSans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

/** Apply on `<html>` so `font-sans` resolves app-wide. */
export const rootFontClassName = interSans.variable;
