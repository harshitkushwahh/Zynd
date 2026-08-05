import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  HandCoins,
  UserRoundPlus,
  Wallet,
} from "lucide-react";

import type {
  DistributorNotification,
  DistributorNotificationKind,
} from "@/lib/dummy/notifications";

type DistributorNotificationVisual = {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
};

const NOTIFICATION_VISUALS: Record<DistributorNotificationKind, DistributorNotificationVisual> = {
  commission: {
    icon: HandCoins,
    iconClassName: "distributor-notification-card__icon--commission",
    label: "Commission",
  },
  compliance: {
    icon: ClipboardCheck,
    iconClassName: "distributor-notification-card__icon--compliance",
    label: "Compliance",
  },
  lead: {
    icon: UserRoundPlus,
    iconClassName: "distributor-notification-card__icon--lead",
    label: "Lead",
  },
  payroll: {
    icon: Wallet,
    iconClassName: "distributor-notification-card__icon--payroll",
    label: "Payroll",
  },
};

export function getDistributorNotificationVisual(
  notification: Pick<DistributorNotification, "kind">,
): DistributorNotificationVisual {
  return NOTIFICATION_VISUALS[notification.kind];
}
