"use client";

import { cn } from "@/lib/utils";

type KycDialogBodyProps = {
  children: React.ReactNode;
  variant?: "default" | "review";
  className?: string;
};

export function KycDialogBody({
  children,
  variant = "default",
  className,
}: KycDialogBodyProps) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1",
        variant === "review"
          ? "flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 pt-3 sm:px-7 sm:pb-7"
          : "min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-7 sm:py-7",
        className,
      )}
    >
      {children}
    </div>
  );
}
