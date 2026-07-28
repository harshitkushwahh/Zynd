import type { LucideIcon } from "lucide-react";
import { Archive, CheckCircle2, CircleDashed, PauseCircle, Trophy } from "lucide-react";

import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { GoalStatus } from "@/features/goals/api/goals-api";

export function goalStatusBadgeVariant(status: GoalStatus): StatusBadgeVariant {
  switch (status) {
    case "active":
    case "achieved":
      return "success";
    case "paused":
      return "warning";
    case "draft":
    case "archived":
    default:
      return "neutral";
  }
}

export function goalStatusBadgeIcon(status: GoalStatus): LucideIcon {
  switch (status) {
    case "active":
      return CheckCircle2;
    case "achieved":
      return Trophy;
    case "paused":
      return PauseCircle;
    case "archived":
      return Archive;
    case "draft":
    default:
      return CircleDashed;
  }
}
