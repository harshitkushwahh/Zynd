"use client";

import { Check, CheckCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type SupportReadReceiptProps = {
  outboundToCustomer?: boolean;
  customerReadAt?: string | null;
  inboundFromCustomer?: boolean;
  supportReadAt?: string | null;
  supportReadBy?: "bot" | "agent" | null;
  tone?: "staff" | "customer";
  className?: string;
};

export function SupportReadReceipt({
  outboundToCustomer = false,
  customerReadAt,
  inboundFromCustomer = false,
  supportReadAt,
  supportReadBy,
  tone = "staff",
  className,
}: SupportReadReceiptProps) {
  const read = outboundToCustomer
    ? Boolean(customerReadAt)
    : inboundFromCustomer
      ? Boolean(supportReadAt)
      : false;

  const title = outboundToCustomer
    ? read
      ? "Read by customer"
      : "Delivered"
    : read
      ? supportReadBy === "bot"
        ? "Read by Help Bot"
        : "Read by you"
      : "Received";

  const Icon = read ? CheckCheck : Check;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5",
        tone === "staff"
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
