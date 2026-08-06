"use client";

import {
  TurnstileWidget as SharedTurnstileWidget,
  isTurnstileEnabled,
  type TurnstileWidgetProps as SharedTurnstileWidgetProps,
} from "@zynd/shared/components/turnstile";

import { env } from "@/lib/env";

type TurnstileWidgetProps = Omit<SharedTurnstileWidgetProps, "siteKey">;

export function TurnstileWidget(props: TurnstileWidgetProps) {
  return <SharedTurnstileWidget siteKey={env.turnstileSiteKey} {...props} />;
}

export function isTurnstileRequired() {
  return isTurnstileEnabled(env.turnstileSiteKey);
}
