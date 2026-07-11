import {
  BadgeCheck,
  Shield,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { NotificationCategory } from "@/features/notifications/api/notifications-api";

export type NotificationCategoryMeta = {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  accentClassName: string;
};

export const NOTIFICATION_CATEGORY_META: Record<
  NotificationCategory,
  NotificationCategoryMeta
> = {
  security: {
    label: "Security",
    icon: Shield,
    iconClassName: "text-amber-600 dark:text-amber-400",
    accentClassName: "border-l-amber-500/70 bg-amber-500/5",
  },
  kyc: {
    label: "KYC",
    icon: BadgeCheck,
    iconClassName: "text-primary",
    accentClassName: "border-l-primary/70 bg-primary/5",
  },
  referral: {
    label: "Referral",
    icon: Users,
    iconClassName: "text-emerald-600 dark:text-emerald-400",
    accentClassName: "border-l-emerald-500/70 bg-emerald-500/5",
  },
  account: {
    label: "Account",
    icon: UserRound,
    iconClassName: "text-sky-600 dark:text-sky-400",
    accentClassName: "border-l-sky-500/70 bg-sky-500/5",
  },
};
