"use client";

import { Bot } from "lucide-react";

import { cn } from "@/lib/utils";

/** Original navbar bot layers (aurora tile) — navbar only. */
export function ZyndAiBotGraphic() {
  return (
    <>
      <span className="zynd-ai-bot-aurora" aria-hidden />
      <span className="zynd-ai-bot-surface">
        <span className="zynd-ai-bot-fold" aria-hidden />
        <span className="zynd-ai-bot-points" aria-hidden>
          {Array.from({ length: 10 }, (_, index) => (
            <i key={index} className="zynd-ai-bot-point" />
          ))}
        </span>
        <span className="zynd-ai-bot-inner">
          <Bot className="zynd-ai-bot-icon" strokeWidth={2.5} />
        </span>
      </span>
    </>
  );
}

const SIZE_CLASS = {
  xs: "size-7 rounded-md [&_svg]:size-3.5",
  sm: "size-9 rounded-lg [&_svg]:size-4",
  md: "size-10 rounded-xl [&_svg]:size-[1.125rem]",
  lg: "size-[4.25rem] rounded-2xl [&_svg]:size-9",
} as const;

/** One simple bot tile — navbar, chat sidebar, hero, and replies. */
export function ZyndAiSimpleIcon({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-[var(--zynd-blue,#2563eb)] to-[var(--zynd-emerald,#10b981)] text-white shadow-sm",
        SIZE_CLASS[size],
        className,
      )}
      aria-hidden
    >
      <Bot strokeWidth={2.25} />
    </span>
  );
}
