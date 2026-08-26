"use client";

import { KycDialogSecurityFooter } from "@/features/kyc/components/kyc-dialog-security-footer";
import { cn } from "@/lib/utils";

type KycDialogBodyProps = {
  children: React.ReactNode;
  variant?: "default" | "review";
  showSecurityFooter?: boolean;
  className?: string;
};

export function KycDialogBody({
  children,
  variant = "default",
  showSecurityFooter = false,
  className,
}: KycDialogBodyProps) {
  const pinReviewLayout = variant === "review" && !showSecurityFooter;
  const contentPadding = pinReviewLayout
    ? "overflow-hidden px-8 pb-3 pt-3 sm:px-10"
    : "px-8 py-8 pb-3 sm:px-10 sm:py-9";
  const reviewTopPadding = variant === "review" && showSecurityFooter ? "pt-3 sm:pt-3" : "";

  if (showSecurityFooter) {
    return (
      <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto",
            contentPadding,
            reviewTopPadding,
          )}
        >
          {children}
        </div>
        <KycDialogSecurityFooter className="px-8 pb-4 pt-2 sm:px-10" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        pinReviewLayout ? contentPadding : cn(contentPadding, "overflow-y-auto"),
        className,
      )}
    >
      {children}
    </div>
  );
}
