"use client";

import { usePathname } from "next/navigation";

import { SupportChatPopover } from "@/features/support/components/support-chat-popover";
import { SupportFabButton } from "@/features/support/components/support-fab-button";
import { cn } from "@/lib/utils";

export function SupportFloatingWidget() {
  const pathname = usePathname();
  const isFundScreener = pathname.startsWith("/dashboard/mutual-funds/all");

  if (isFundScreener) {
    return <SupportChatPopover />;
  }

  return (
    <>
      <SupportChatPopover />
      <SupportFabButton
        className={cn(
          "fixed z-50",
          "bottom-[4.75rem] right-3 md:bottom-6 md:right-6",
        )}
      />
    </>
  );
}
