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
        "flex min-h-0 flex-1 flex-col",
        variant === "review"
          ? "overflow-hidden px-8 pb-3 pt-3 sm:px-10"
          : "overflow-y-auto px-8 py-8 pb-3 sm:px-10 sm:py-9",
        className,
      )}
    >
      {children}
    </div>
  );
}
