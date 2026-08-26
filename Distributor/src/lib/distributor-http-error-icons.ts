import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Clock,
  FileQuestion,
  Lock,
  ServerCrash,
  ShieldX,
  WifiOff,
} from "lucide-react";

import {
  getHttpErrorContent,
  isDistributorHttpErrorCode,
  type DistributorHttpErrorCode,
} from "@/lib/distributor-http-error-catalog";

const HTTP_ERROR_ICONS: Record<DistributorHttpErrorCode, LucideIcon> = {
  400: AlertCircle,
  401: Lock,
  403: ShieldX,
  404: FileQuestion,
  408: Clock,
  429: Ban,
  500: ServerCrash,
  502: WifiOff,
  503: AlertTriangle,
};

export function getHttpErrorIcon(code: number): LucideIcon {
  if (isDistributorHttpErrorCode(code)) {
    return HTTP_ERROR_ICONS[code];
  }

  if (code >= 500) {
    return HTTP_ERROR_ICONS[500];
  }

  if (code === 401) {
    return HTTP_ERROR_ICONS[401];
  }

  if (code === 403) {
    return HTTP_ERROR_ICONS[403];
  }

  if (code === 404) {
    return HTTP_ERROR_ICONS[404];
  }

  return AlertCircle;
}

export function resolveHttpErrorDisplay(code: number) {
  return {
    ...getHttpErrorContent(code),
    icon: getHttpErrorIcon(code),
  };
}
