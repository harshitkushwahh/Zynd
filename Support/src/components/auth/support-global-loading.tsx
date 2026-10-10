"use client";

import Image from "next/image";

import { ZYND_SUPPORT_FAVICON_PNG_SRC } from "@/lib/support-brand-assets";

type SupportGlobalLoadingProps = {
  /** Status line before the animated dots. */
  message?: string;
  /** @default true */
  trailingDots?: boolean;
};

export function SupportGlobalLoading({
  message = "Loading support console",
  trailingDots = true,
}: SupportGlobalLoadingProps) {
  return (
    <div className="support-global-loading" role="status" aria-live="polite">
      <Image
        src={ZYND_SUPPORT_FAVICON_PNG_SRC}
        alt="Zynd Support"
        width={88}
        height={88}
        className="support-global-loading__logo"
        priority
      />
      <p className="support-global-loading__message">
        <span>{message}</span>
        {trailingDots ? (
          <span className="support-global-loading__dots" aria-hidden="true">
            <span className="support-global-loading__dot">.</span>
            <span className="support-global-loading__dot">.</span>
            <span className="support-global-loading__dot">.</span>
          </span>
        ) : null}
      </p>
    </div>
  );
}
