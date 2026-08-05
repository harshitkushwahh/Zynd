"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type PendingNavigation =
  | { type: "href"; href: string }
  | { type: "back" };

type UseRiskAssessmentLeaveGuardOptions = {
  enabled: boolean;
  onSaveAndLeave: () => Promise<void>;
};

export function useRiskAssessmentLeaveGuard({
  enabled,
  onSaveAndLeave,
}: UseRiskAssessmentLeaveGuardOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingNavigationRef = useRef<PendingNavigation | null>(null);
  const allowLeaveRef = useRef(false);

  const proceedNavigation = useCallback(() => {
    const pending = pendingNavigationRef.current;
    pendingNavigationRef.current = null;

    if (!pending) return;

    if (pending.type === "back") {
      allowLeaveRef.current = true;
      router.back();
      return;
    }

    allowLeaveRef.current = true;
    router.push(pending.href);
  }, [router]);

  const confirmLeave = useCallback(async () => {
    setSaving(true);
    try {
      await onSaveAndLeave();
      setOpen(false);
      proceedNavigation();
    } finally {
      setSaving(false);
    }
  }, [onSaveAndLeave, proceedNavigation]);

  const cancelLeave = useCallback(() => {
    pendingNavigationRef.current = null;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      allowLeaveRef.current = false;
      return;
    }

    history.pushState({ riskAssessmentLeaveGuard: true }, "", window.location.href);

    const handlePopState = () => {
      if (allowLeaveRef.current) return;
      history.pushState({ riskAssessmentLeaveGuard: true }, "", window.location.href);
      pendingNavigationRef.current = { type: "back" };
      setOpen(true);
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (allowLeaveRef.current) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
        return;
      }

      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return;

      const nextPath = `${url.pathname}${url.search}${url.hash}`;
      if (nextPath === pathname) return;

      event.preventDefault();
      event.stopPropagation();
      pendingNavigationRef.current = { type: "href", href: nextPath };
      setOpen(true);
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [enabled, pathname]);

  return {
    open,
    saving,
    confirmLeave,
    cancelLeave,
    setOpen,
  };
}
