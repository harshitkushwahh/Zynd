"use client";

import { useState } from "react";
import {
  Bell,
  Building2,
  KeyRound,
  Laptop,
  LockKeyhole,
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
import { cn } from "@/lib/utils";

export type SettingsSection =
  | "personal-details"
  | "bank-account"
  | "mfa"
  | "zynd-pin"
  | "change-password"
  | "change-email"
  | "your-devices"
  | "notifications"
  | "delete-account";

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
    id: "mfa",
    label: "MFA",
    title: copy.settings.mfaTitle,
    description: copy.settings.mfaDescription,
    icon: Shield,
  },
  {
    id: "zynd-pin",
    label: copy.settings.zyndPinTitle,
    title: copy.settings.zyndPinTitle,
    description: copy.settings.zyndPinDescription,
    icon: LockKeyhole,
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
    description: copy.account.deletionGracePeriodShort(),
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
  const { user, displayName } = useAuth();
  const { profileUrl, refreshProfileImage } = useProfileImage();
  const [uploadOpen, setUploadOpen] = useState(false);

  if (!user) {
    return null;
  }

  const initials = getUserInitials(user.first_name, user.email);

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card md:h-full md:w-72">
      <div className="shrink-0 border-b border-border px-5 py-6 text-center">
        <div className="relative mx-auto size-[4.5rem]">
          <Avatar className="size-full">
            {profileUrl ? <AvatarImage src={profileUrl} alt={displayName || copy.settings.profilePhotoAlt} /> : null}
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
          {displayName || copy.settings.accountFallbackName}
        </p>
      </div>

      <ProfilePhotoUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => void refreshProfileImage()}
      />

      <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SETTINGS_NAV.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-control)] px-3.5 py-3 text-left text-compact font-medium transition-colors",
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
