import type { ReactNode } from "react";

import { DISTRIBUTOR_LABEL_CAPS_TINY_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

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
      <dd className="text-compact font-medium leading-snug text-foreground">{children}</dd>
    </div>
  );
}
