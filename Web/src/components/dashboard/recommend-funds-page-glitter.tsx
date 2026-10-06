"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

const GLITTER_COUNT = 44;

type GlitterSpec = {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  tone: number;
};

function buildGlitter(count: number): GlitterSpec[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * 100,
    size: 2 + Math.random() * 5,
    delay: -Math.random() * 16,
    duration: 11 + Math.random() * 9,
    drift: (Math.random() - 0.5) * 110,
    tone: Math.floor(Math.random() * 3),
  }));
}

export function RecommendFundsPageGlitter() {
  const [specs] = useState(() => buildGlitter(GLITTER_COUNT));

  return (
    <div className="rf-kyc-overlay-glitter" aria-hidden>
      {specs.map((spec) => (
        <span
          key={spec.id}
          className={cn("rf-kyc-overlay-glitter-dot", `rf-kyc-overlay-glitter-dot-${spec.tone}`)}
          style={
            {
              left: `${spec.left}%`,
              width: `${spec.size}px`,
              height: `${spec.size}px`,
              animationDelay: `${spec.delay}s, ${spec.delay / 2}s`,
              animationDuration: `${spec.duration}s, ${1.8 + (spec.id % 5) * 0.35}s`,
              "--rf-glitter-drift": `${spec.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
