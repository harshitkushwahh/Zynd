"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Building2,
  KeyRound,
  Laptop,
  Mail,
  Pencil,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";

import { ProfilePhotoUploadDialog } from "@/components/dashboard/settings/profile-photo-upload-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { useProfileImage } from "@/contexts/profile-image-context";
import { copy } from "@/shared/config/copy";
import { getUserInitials } from "@/shared/utils/user-display";
import { useResolvedDisplayName } from "@/shared/hooks/use-resolved-display-name";
import { cn } from "@/lib/utils";

export type SettingsSection =
  | "personal-details"
  | "bank-account"
  | "security"
  | "change-password"
  | "change-email"
  | "your-devices"
  | "notifications"
  | "delete-account";

/** Legacy ?section= values mapped to current nav ids. */
export const SETTINGS_SECTION_ALIASES: Partial<Record<string, SettingsSection>> = {
  mfa: "security",
  "zynd-pin": "security",
};

export const PROFILE_SETTINGS_SECTIONS: SettingsSection[] = ["personal-details", "bank-account"];

export const SETTINGS_NAV: {
  id: SettingsSection;
  label: string;
  title: string;
  description: string;
  icon: typeof UserRound;
}[] = [
  {
    id: "personal-details",
    label: copy.settings.profileTitle,
    title: copy.settings.profileTitle,
    description: copy.account.profileOnApp,
    icon: UserRound,
  },
  {
    id: "bank-account",
    label: copy.settings.bankAccountTitle,
    title: copy.settings.bankAccountTitle,
    description: copy.settings.bankAccountDescription,
    icon: Building2,
  },
  {
    id: "security",
    label: copy.settings.securityTitle,
    title: copy.settings.securityTitle,
    description: copy.settings.securityDescription,
    icon: Shield,
  },
  {
    id: "change-password",
    label: copy.settings.changePasswordTitle,
    title: copy.settings.changePasswordTitle,
    description: copy.settings.changePasswordDescription,
    icon: KeyRound,
  },
  {
    id: "change-email",
    label: copy.settings.changeEmailTitle,
    title: copy.settings.changeEmailTitle,
    description: copy.settings.changeEmailDescription,
    icon: Mail,
  },
  {
    id: "your-devices",
    label: copy.settings.devicesTitle,
    title: copy.settings.devicesTitle,
    description: copy.account.maxActiveDevices(),
    icon: Laptop,
  },
  {
    id: "notifications",
    label: copy.settings.notificationsTitle,
    title: copy.settings.notificationsPreferencesTitle,
    description: copy.settings.notificationsPreferencesDescription,
    icon: Bell,
  },
  {
    id: "delete-account",
    label: copy.settings.deleteAccountTitle,
    title: copy.settings.deleteAccountTitle,
    description: copy.settings.deleteAccountDescription,
    icon: Trash2,
  },
];

type SettingsSidebarProps = {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
};

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  const { user } = useAuth();
  const resolvedDisplayName = useResolvedDisplayName();
  const { profileUrl, refreshProfileImage } = useProfileImage();
  const [uploadOpen, setUploadOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [navScrollable, setNavScrollable] = useState(false);

  const updateNavScrollable = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    setNavScrollable(nav.scrollHeight > nav.clientHeight + 1);
  }, []);

  useEffect(() => {
    if (!user) return;

    const nav = navRef.current;
    if (!nav) return;

    const measure = () => {
      requestAnimationFrame(updateNavScrollable);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    if (nav.parentElement) {
      observer.observe(nav.parentElement);
    }

    return () => observer.disconnect();
  }, [updateNavScrollable, user]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const activeButton = nav.querySelector<HTMLButtonElement>(`[data-settings-section="${activeSection}"]`);
    activeButton?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSection]);

  if (!user) {
    return null;
  }

  const initials = getUserInitials(resolvedDisplayName.split(/\s+/)[0], user.email);

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card md:h-full md:max-h-full md:w-72 md:min-h-0">
      <div className="shrink-0 border-b border-border px-5 py-6 text-center">
        <div className="relative mx-auto size-[4.5rem]">
          <Avatar className="size-full">
            {profileUrl ? (
              <AvatarImage src={profileUrl} alt={resolvedDisplayName || copy.settings.profilePhotoAlt} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-h3 font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            aria-label={copy.profilePhoto.editAriaLabel}
            onClick={() => setUploadOpen(true)}
            className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-2 border-card bg-foreground text-background shadow-zynd-low transition-colors hover:bg-foreground/90"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
        <p className="mt-3.5 truncate text-body font-semibold text-foreground">
          {resolvedDisplayName || copy.settings.accountFallbackName}
        </p>
      </div>

      <ProfilePhotoUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => void refreshProfileImage()}
      />

      <nav
        ref={navRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-1.5 p-4",
          navScrollable
            ? "overflow-y-auto overscroll-y-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
            : "overflow-y-hidden",
        )}
      >
        {SETTINGS_NAV.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              data-settings-section={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-control)] px-3.5 py-3 text-left text-compact font-medium transition-[color,background-color,transform] duration-200 ease-out motion-reduce:transition-none",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                item.id === "delete-account" &&
                  !active &&
                  "text-destructive hover:bg-destructive/10 hover:text-destructive"
              )}
            >
              <Icon className="size-[1.125rem] shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
