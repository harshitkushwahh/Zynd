"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import "@/styles/zynd-recommend-funds-kyc-overlay.css";
import { RecommendFundsPageGlitter } from "@/components/dashboard/recommend-funds-page-glitter";
import { RECOMMEND_FUNDS_PAGE_GRAINIENT_PROPS } from "@/components/dashboard/recommend-funds-theme";
import { Grainient } from "@/components/ui/grainient";
import { cn } from "@/lib/utils";

type RecommendFundsFullPageShellProps = {
  children: ReactNode;
  onClose: () => void;
  closeLabel: string;
  contentClassName?: string;
};

const subscribeNoop = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

function RecommendFundsFullPageShellContent({
  children,
  onClose,
  closeLabel,
  contentClassName,
}: RecommendFundsFullPageShellProps) {
  const [grainientReady, setGrainientReady] = useState(false);

  const handleGrainientReady = useCallback(() => {
    setGrainientReady(true);
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="rf-kyc-overlay">
      <div
        className={cn("rf-kyc-overlay-bg", grainientReady && "rf-kyc-overlay-bg-ready")}
        aria-hidden
      >
        <Grainient {...RECOMMEND_FUNDS_PAGE_GRAINIENT_PROPS} onReady={handleGrainientReady} />
      </div>
      <div className="rf-kyc-overlay-vignette" aria-hidden />
      <div className="rf-kyc-overlay-blob rf-kyc-overlay-blob-a" aria-hidden />
      <div className="rf-kyc-overlay-blob rf-kyc-overlay-blob-b" aria-hidden />
      <div className="rf-kyc-overlay-blob rf-kyc-overlay-blob-c" aria-hidden />
      <RecommendFundsPageGlitter />

      <button
        type="button"
        className="rf-kyc-overlay-close"
        aria-label={closeLabel}
        onClick={onClose}
      >
        <X className="size-4" strokeWidth={2.25} aria-hidden />
      </button>

      <div
        className={cn(
          "rf-kyc-overlay-content rf-funds-page-content",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function RecommendFundsFullPageShell(props: RecommendFundsFullPageShellProps) {
  const isClient = useIsClient();
  if (!isClient) return null;

  return createPortal(
    <RecommendFundsFullPageShellContent {...props} />,
    document.body,
  );
}
