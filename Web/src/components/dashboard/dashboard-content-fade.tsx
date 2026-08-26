"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DashboardContentFadeProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardContentFade({ children, className }: DashboardContentFadeProps) {
  return <div className={cn("animate-in fade-in duration-300 ease-out", className)}>{children}</div>;
}
