"use client";

import Image from "next/image";

import { ZYND_DISTRIBUTOR_LOGO_SRC } from "@/lib/distributor-brand-assets";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

type DistributorGlobalLoadingProps = {
  message?: string;
  className?: string;
};

function loadingMessageBase(message: string) {
  return message.replace(/[.…]+$/u, "").trimEnd();
}

export function DistributorGlobalLoading({
  message = ZYND_MITRA_COPY.loadingConsole,
  className,
}: DistributorGlobalLoadingProps) {
  const messageText = loadingMessageBase(message);

  return (
    <div
      className={cn("distributor-global-loading", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`${messageText}…`}
    >
      <Image
        src={ZYND_DISTRIBUTOR_LOGO_SRC}
        alt=""
        width={88}
        height={88}
        priority
        className="distributor-global-loading__logo"
        aria-hidden
      />
      <p className="distributor-global-loading__message">
        {messageText}
        <span className="distributor-global-loading__dots" aria-hidden>
          <span className="distributor-global-loading__dot" />
          <span className="distributor-global-loading__dot" />
          <span className="distributor-global-loading__dot" />
        </span>
      </p>
    </div>
  );
}
