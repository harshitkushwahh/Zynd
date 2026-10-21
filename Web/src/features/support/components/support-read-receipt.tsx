"use client";

import { Check, CheckCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type SupportReadReceiptProps = {
  /** Customer's own message — seen by agent or bot */
  outboundToSupport?: boolean;
  supportReadAt?: string | null;
  supportReadBy?: "bot" | "agent" | null;
  /** Agent/bot message — seen by customer */
  inboundReadByCustomer?: boolean;
  customerReadAt?: string | null;
  /** Bubble on the right (customer) vs left (agent) */
  tone?: "outbound" | "inbound";
  className?: string;
};

export function SupportReadReceipt({
  outboundToSupport = false,
  supportReadAt,
  supportReadBy,
  inboundReadByCustomer = false,
  customerReadAt,
  tone = "outbound",
  className,
}: SupportReadReceiptProps) {
  const read = outboundToSupport
    ? Boolean(supportReadAt)
    : inboundReadByCustomer
      ? Boolean(customerReadAt)
      : false;

  const title = outboundToSupport
    ? read
      ? supportReadBy === "bot"
        ? "Read by Zynd Help Bot"
        : "Read by support"
      : "Sent"
    : read
      ? "Read by you"
      : "Delivered";

  const Icon = read ? CheckCheck : Check;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5",
        tone === "outbound"
          ? read
            ? "text-primary-foreground/85"
            : "text-primary-foreground/55"
          : read
            ? "text-muted-foreground"
            : "text-muted-foreground/60",
        className,
      )}
      title={title}
      aria-label={title}
    >
      <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />
    </span>
  );
}
