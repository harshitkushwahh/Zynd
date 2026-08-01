"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminAuthButtonVariants = cva("admin-auth-button", {
  variants: {
    variant: {
      primary: "admin-auth-button--primary",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

type AdminAuthButtonProps = ComponentProps<typeof Button> &
  VariantProps<typeof adminAuthButtonVariants>;

export function AdminAuthButton({
  className,
  variant = "primary",
  size = "lg",
  ...props
}: AdminAuthButtonProps) {
  return (
    <Button
      className={cn(adminAuthButtonVariants({ variant }), className)}
      size={size}
      {...props}
    />
  );
}
