"use client";

import { DistributorPageBackButton } from "@/components/dashboard/distributor-page-back-button";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type ClientDetailNotFoundViewProps = {
  backHref: string;
  message?: string;
  className?: string;
};

export function ClientDetailNotFoundView({
  backHref,
  message = DISTRIBUTOR_CLIENT_COPY.clientNotFound,
  className,
}: ClientDetailNotFoundViewProps) {
  return (
    <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "space-y-3", className)}>
      <DistributorPageBackButton href={backHref} />
      <p className="text-compact text-muted-foreground">{message}</p>
    </div>
  );
}
