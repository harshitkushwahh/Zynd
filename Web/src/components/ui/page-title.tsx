import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const PAGE_TITLE_CLASS = "text-h4 font-semibold tracking-tight text-foreground";

export function PageTitle({ className, ...props }: ComponentProps<"h1">) {
  return <h1 data-page-title className={cn(PAGE_TITLE_CLASS, className)} {...props} />;
}

export function SectionTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 data-page-title className={cn(PAGE_TITLE_CLASS, className)} {...props} />;
}
