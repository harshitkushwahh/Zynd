"use client";

import { usePathname } from "next/navigation";

import { SupportChatPopover } from "@/features/support/components/support-chat-popover";
import { SupportFabButton } from "@/features/support/components/support-fab-button";
import { useSupportWidgetOptional } from "@/features/support/contexts/support-widget-context";
import { cn } from "@/lib/utils";

export function SupportFloatingWidget() {
  const pathname = usePathname();
  const support = useSupportWidgetOptional();
  const isFundScreener = pathname.startsWith("/dashboard/mutual-funds/all");
  const isHelpChatPage =
    pathname.startsWith("/dashboard/help") && support?.panelView === "chat";

  if (isFundScreener) {
    return <SupportChatPopover />;
  }

  return (
    <>
      <SupportChatPopover />
      {isHelpChatPage ? null : (
        <SupportFabButton
          className={cn(
            "fixed z-50",
            "bottom-[4.75rem] right-3 md:bottom-6 md:right-6",
          )}
        />
      )}
    </>
  );
}
