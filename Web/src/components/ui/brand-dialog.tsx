"use client";

import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

type BrandDialogMaxWidth = "md" | "lg" | "xl";

export type BrandDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  maxWidth?: BrandDialogMaxWidth;
  showCloseButton?: boolean;
  headerAction?: ReactNode;
  className?: string;
  overlayClassName?: string;
};

const maxWidthClass: Record<BrandDialogMaxWidth, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-5xl",
};

const DIALOG_TITLE_ACRONYMS: Record<string, string> = {
  mfa: "MFA",
  pin: "PIN",
  sms: "SMS",
  otp: "OTP",
  kyc: "KYC",
  sip: "SIP",
  api: "API",
  qr: "QR",
  json: "JSON",
  zynd: "Zynd",
};

function formatDialogTitleWord(word: string): string {
  const lower = word.toLowerCase();
  if (DIALOG_TITLE_ACRONYMS[lower]) {
    return DIALOG_TITLE_ACRONYMS[lower];
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatDialogTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return trimmed;
  return trimmed
    .split(/\s+/)
    .map(formatDialogTitleWord)
    .join(" ");
}

export function BrandDialog({
  open,
  onOpenChange,
  title,
  children,
  maxWidth = "md",
  showCloseButton = true,
  headerAction,
  className,
  overlayClassName,
}: BrandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          maxWidthClass[maxWidth],
          ZYND_3XL_RADIUS_CLASS,
          "!flex flex-col overflow-hidden p-0",
          className,
        )}
        closeTone="default"
        showCloseButton={false}
        overlayClassName={overlayClassName}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="relative flex shrink-0 items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
          <h2 className="min-w-0 text-compact font-semibold leading-snug text-muted-foreground">
            {formatDialogTitle(title)}
          </h2>

          {headerAction || showCloseButton ? (
            <div className="flex shrink-0 items-center gap-2">
              {headerAction}
              {showCloseButton ? (
                <DialogClose
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Close"
                    />
                  }
                >
                  <XIcon className="size-4" strokeWidth={2} />
                </DialogClose>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

type BrandDialogFooterProps = {
  children: ReactNode;
  className?: string;
};

export function BrandDialogFooter({ children, className }: BrandDialogFooterProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 px-6 py-4 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}
