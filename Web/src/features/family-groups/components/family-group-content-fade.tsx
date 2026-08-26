"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function FamilyGroupContentFade({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("animate-in fade-in duration-200 ease-out", className)}>{children}</div>;
}
