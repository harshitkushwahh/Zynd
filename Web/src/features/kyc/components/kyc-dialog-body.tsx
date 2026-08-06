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

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        pinReviewLayout
          ? "overflow-hidden px-8 pb-3 pt-3 sm:px-10"
          : "overflow-y-auto px-8 py-8 pb-3 sm:px-10 sm:py-9",
        variant === "review" && showSecurityFooter && "pt-3 sm:pt-3",
        className,
      )}
    >
      {children}
      {showSecurityFooter ? (
        <KycDialogSecurityFooter className="px-0 pb-1 pt-5" />
      ) : null}
    </div>
  );
}
