"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

type QuickTransactionPageCloseButtonProps = {
  disabled?: boolean;
};

export function QuickTransactionPageCloseButton({
  disabled = false,
}: QuickTransactionPageCloseButtonProps) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="quick-txn-page-close shrink-0 rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label="Close quick transaction"
      disabled={disabled}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push("/dashboard");
      }}
    >
      <X className="size-4" strokeWidth={2.25} aria-hidden />
    </Button>
  );
}
