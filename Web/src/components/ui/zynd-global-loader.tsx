"use client";

import { useEffect, useId, useState } from "react";

import { getRandomFinanceQuote, type FinanceQuote } from "@/lib/finance-quotes";
import { cn } from "@/lib/utils";

type ZyndGlobalLoaderProps = {
  className?: string;
  /** Optional status line shown below the quote (e.g. reconnecting). */
  status?: string;
};

/**
 * Global full-screen ZYND web loader.
 * Use this anywhere the app needs a centered loading state — not inline spinners.
 */
export function ZyndGlobalLoader({ className, status }: ZyndGlobalLoaderProps) {
  const maskId = useId().replace(/:/g, "");
  const [quote, setQuote] = useState<FinanceQuote | null>(null);

  useEffect(() => {
    setQuote(getRandomFinanceQuote());
  }, []);

  return (
    <div className={cn("zynd-global-loader-screen", className)} role="status" aria-live="polite">
      <div className="zynd-global-loader" aria-hidden="true">
        <svg width={100} height={100} viewBox="0 0 100 100" className="zynd-global-loader__svg">
          <defs>
            <mask id={maskId} className="zynd-global-loader__mask">
              <polygon points="0,0 100,0 100,100 0,100" fill="black" />
              <polygon points="25,25 75,25 50,75" fill="white" />
              <polygon points="50,25 75,75 25,75" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
            </mask>
          </defs>
        </svg>
        <div
          className="zynd-global-loader__box"
          style={
            {
              "--zynd-loader-mask": `url(#${maskId})`,
            } as React.CSSProperties
          }
        />
      </div>

      <blockquote
        className={cn("zynd-global-loader-quote", !quote && "zynd-global-loader-quote--pending")}
      >
        {quote ?? "\u00A0"}
      </blockquote>

      {status ? <p className="zynd-global-loader-status">{status}</p> : null}
    </div>
  );
}
