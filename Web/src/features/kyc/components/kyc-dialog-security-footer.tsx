"use client";

import Image from "next/image";
import { LockKeyhole, ShieldCheck, type LucideIcon } from "lucide-react";

import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycDialogSecurityFooterProps = {
  className?: string;
};

const FOOTER_ICONS: LucideIcon[] = [LockKeyhole, ShieldCheck];

export function KycDialogSecurityFooter({ className }: KycDialogSecurityFooterProps) {
  const footerCopy = copy.kyc.securityFooter;

  return (
    <footer className={cn("shrink-0 px-6 pb-4 pt-0.5 sm:px-8", className)}>
      <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
        <span className="inline-flex items-center gap-1 text-[9px] leading-none text-muted-foreground">
          <Image
            src="/partners/cybrilla-icon.png"
            alt="Cybrilla"
            width={12}
            height={12}
            className="size-3 shrink-0 rounded-[2px]"
          />
          <span>{footerCopy.backedBy}</span>
        </span>

        {footerCopy.items.map((item, index) => {
          const Icon = FOOTER_ICONS[index] ?? LockKeyhole;

          return (
            <span
              key={item.label}
              className="inline-flex items-center gap-0.5 text-[9px] leading-none text-muted-foreground"
            >
              <Icon className="size-2.5 shrink-0 text-muted-foreground/55" strokeWidth={2} aria-hidden />
              {item.label}
            </span>
          );
        })}
      </div>
    </footer>
  );
}
