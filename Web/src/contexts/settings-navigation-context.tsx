"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  PROFILE_SETTINGS_SECTIONS,
  type SettingsSection,
} from "@/components/dashboard/settings/settings-sidebar";

type SettingsNavigationContextValue = {
  activeSection: SettingsSection;
  setActiveSection: (section: SettingsSection) => void;
  isProfileSettingsView: boolean;
  openSettings: (section?: SettingsSection) => void;
};

const SettingsNavigationContext = createContext<SettingsNavigationContextValue | null>(null);

export function SettingsNavigationProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("personal-details");

  const isProfileSettingsView = PROFILE_SETTINGS_SECTIONS.includes(activeSection);

  const openSettings = useCallback((section: SettingsSection = "personal-details") => {
    setActiveSection(section);
  }, []);

  const value = useMemo(
    () => ({
      activeSection,
      setActiveSection,
      isProfileSettingsView,
      openSettings,
    }),
    [activeSection, isProfileSettingsView, openSettings],
  );

  return (
    <SettingsNavigationContext.Provider value={value}>
      {children}
    </SettingsNavigationContext.Provider>
  );
}

export function useSettingsNavigation() {
  const context = useContext(SettingsNavigationContext);
  if (!context) {
    throw new Error("useSettingsNavigation must be used within SettingsNavigationProvider");
  }
  return context;
}

export function useSettingsNavigationOptional() {
  return useContext(SettingsNavigationContext);
}
