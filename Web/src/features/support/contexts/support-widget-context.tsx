"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useSupportChat } from "@/features/support/hooks/use-support-chat";
import type {
  SupportHelpTab,
  SupportPanelView,
  SupportViewMode,
} from "@/features/support/lib/support-types";

const HELP_PAGE_HREF = "/dashboard/help";

type SupportWidgetContextValue = {
  viewMode: SupportViewMode;
  panelView: SupportPanelView;
  helpTab: SupportHelpTab;
  isOpen: boolean;
  isFullscreen: boolean;
  isHelpPage: boolean;
  openPopover: () => void;
  openFullscreen: () => void;
  close: () => void;
  togglePopover: () => void;
  expandToFullscreen: () => void;
  collapseToPopover: () => void;
  setHelpTab: (tab: SupportHelpTab) => void;
  openChat: () => void;
  backToHelp: () => void;
  chat: ReturnType<typeof useSupportChat>;
};

const SupportWidgetContext = createContext<SupportWidgetContextValue | null>(null);

export function SupportWidgetProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const returnPathRef = useRef("/dashboard");
  const [viewMode, setViewMode] = useState<SupportViewMode>("closed");
  const [panelView, setPanelView] = useState<SupportPanelView>("help");
  const [helpTab, setHelpTab] = useState<SupportHelpTab>("home");
  const chat = useSupportChat();

  const isHelpPage = pathname.startsWith(HELP_PAGE_HREF);

  const resetHelp = useCallback(() => {
    setPanelView("help");
    setHelpTab("home");
  }, []);

  const goToHelpPage = useCallback(() => {
    if (!pathname.startsWith(HELP_PAGE_HREF)) {
      returnPathRef.current = pathname || "/dashboard";
    }
    setViewMode("closed");
    router.push(HELP_PAGE_HREF);
  }, [pathname, router]);

  const openPopover = useCallback(() => {
    resetHelp();
    setViewMode("popover");
  }, [resetHelp]);

  const openFullscreen = useCallback(() => {
    goToHelpPage();
  }, [goToHelpPage]);

  const close = useCallback(() => {
    setViewMode("closed");
    resetHelp();
    if (pathname.startsWith(HELP_PAGE_HREF)) {
      router.push(returnPathRef.current || "/dashboard");
    }
  }, [pathname, resetHelp, router]);

  const expandToFullscreen = useCallback(() => {
    goToHelpPage();
  }, [goToHelpPage]);

  const collapseToPopover = useCallback(() => {
    setViewMode("popover");
    if (pathname.startsWith(HELP_PAGE_HREF)) {
      router.push(returnPathRef.current || "/dashboard");
    }
  }, [pathname, router]);

  const togglePopover = useCallback(() => {
    setViewMode((current) => {
      if (current === "popover") {
        resetHelp();
        return "closed";
      }
      resetHelp();
      return "popover";
    });
  }, [resetHelp]);

  const openChat = useCallback(() => setPanelView("chat"), []);
  const backToHelp = useCallback(() => setPanelView("help"), []);

  const value = useMemo(
    () => ({
      viewMode: isHelpPage ? "fullscreen" : viewMode,
      panelView,
      helpTab,
      isOpen: isHelpPage || viewMode !== "closed",
      isFullscreen: isHelpPage,
      isHelpPage,
      openPopover,
      openFullscreen,
      close,
      togglePopover,
      expandToFullscreen,
      collapseToPopover,
      setHelpTab,
      openChat,
      backToHelp,
      chat,
    }),
    [
      isHelpPage,
      viewMode,
      panelView,
      helpTab,
      openPopover,
      openFullscreen,
      close,
      togglePopover,
      expandToFullscreen,
      collapseToPopover,
      openChat,
      backToHelp,
      chat,
    ],
  );

  return (
    <SupportWidgetContext.Provider value={value}>{children}</SupportWidgetContext.Provider>
  );
}

export function useSupportWidget() {
  const context = useContext(SupportWidgetContext);
  if (!context) {
    throw new Error("useSupportWidget must be used within SupportWidgetProvider");
  }
  return context;
}

export function useSupportWidgetOptional() {
  return useContext(SupportWidgetContext);
}
