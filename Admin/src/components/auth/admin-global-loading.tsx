"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

export const ADMIN_GLOBAL_LOADING_MESSAGE = "Loading Zynd Admin Console";

type AdminGlobalLoadingProps = {
  message?: string;
  className?: string;
  fullScreen?: boolean;
};

function loadingMessageBase(message: string) {
  return message.replace(/[.…]+$/u, "").trimEnd();
}

export function AdminGlobalLoading({
  message = ADMIN_GLOBAL_LOADING_MESSAGE,
  className,
  fullScreen = true,
}: AdminGlobalLoadingProps) {
  const messageText = loadingMessageBase(message);

  return (
    <div
      className={cn(
        "admin-global-loading",
        fullScreen ? "admin-global-loading--fullscreen" : "admin-global-loading--embedded",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`${messageText}…`}
    >
      <Image
        src="/zynda.png"
        alt=""
        width={88}
        height={88}
        priority
        className="admin-global-loading__logo"
        aria-hidden
      />
      <p className="admin-global-loading__message">
        {messageText}
        <span className="admin-global-loading__dots" aria-hidden>
          <span className="admin-global-loading__dot" />
          <span className="admin-global-loading__dot" />
          <span className="admin-global-loading__dot" />
        </span>
      </p>
    </div>
  );
}
