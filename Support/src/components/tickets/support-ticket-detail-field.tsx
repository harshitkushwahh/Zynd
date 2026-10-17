import type { ReactNode } from "react";

import { DISTRIBUTOR_LABEL_CAPS_TINY_CLASS } from "@/lib/distributor-layout";
import {
  normalizeSupportDisplayValue,
  SUPPORT_EMPTY_VALUE,
} from "@/lib/support-display-value";
import { cn } from "@/lib/utils";

function renderDetailValue(children: ReactNode): ReactNode {
  if (typeof children === "string") {
    const normalized = normalizeSupportDisplayValue(children);
    if (normalized === SUPPORT_EMPTY_VALUE) {
      return <span className="font-normal text-muted-foreground">{SUPPORT_EMPTY_VALUE}</span>;
    }
    return normalized;
  }
  return children;
}

type SupportTicketDetailFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function SupportTicketDetailField({
  label,
  children,
  className,
}: SupportTicketDetailFieldProps) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <dt className={cn(DISTRIBUTOR_LABEL_CAPS_TINY_CLASS, "block leading-none")}>{label}</dt>
      <dd className="text-compact font-medium leading-snug text-foreground">
        {renderDetailValue(children)}
      </dd>
    </div>
  );
}
