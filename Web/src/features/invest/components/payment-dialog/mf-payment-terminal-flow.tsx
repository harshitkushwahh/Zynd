"use client";

import { useEffect, useState } from "react";

import { MfPaymentProgressBar } from "@/features/invest/components/payment-dialog/mf-payment-progress-bar";
import { MfPaymentTrustStrip } from "@/features/invest/components/payment-dialog/mf-payment-trust-strip";
import { cn } from "@/lib/utils";

type MfPaymentTerminalFlowProps = {
  lines: string[];
  className?: string;
};

const TYPE_MS = 22;

export function MfPaymentTerminalFlow({ lines, className }: MfPaymentTerminalFlowProps) {
  const safeLines = lines.length > 0 ? lines : ["processing"];
  const completedLines = safeLines.slice(0, -1);
  const activeLine = safeLines[safeLines.length - 1] ?? "processing";
  const [typed, setTyped] = useState("");

  useEffect(() => {
    setTyped("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTyped(activeLine.slice(0, index));
      if (index >= activeLine.length) {
        window.clearInterval(timer);
      }
    }, TYPE_MS);

    return () => window.clearInterval(timer);
  }, [activeLine]);

  const showCursor = typed.length <= activeLine.length;

  return (
    <div className={cn("flex flex-col items-center gap-6 py-1", className)}>
      <MfPaymentTrustStrip />
      <MfPaymentProgressBar
        active
        variant="indeterminate"
        className="w-full max-w-[15rem] [&_[role=progressbar]]:h-1.5"
      />
      <div
        className={cn(
          "w-full max-w-[18rem] rounded-2xl border border-border/50 bg-muted/15 px-4 py-3.5 font-mono text-[11px] leading-relaxed sm:text-caption",
        )}
        aria-live="polite"
        aria-atomic="false"
      >
        {completedLines.map((line, index) => (
          <p key={`${line}-${index}`} className="text-muted-foreground">
            <span className="select-none text-primary/55">&gt;</span> {line}
          </p>
        ))}
        <p className="text-foreground">
          <span className="select-none text-primary/55">&gt;</span> {typed}
          {showCursor ? (
            <span
              className="ml-px inline-block h-[0.85em] w-[0.42em] animate-pulse bg-primary/75 align-[-0.08em]"
              aria-hidden="true"
            />
          ) : null}
        </p>
      </div>
    </div>
  );
}
