"use client";

import { UserRoundX } from "lucide-react";

import { ClientDetailEmptyState } from "@/components/clients/client-detail-empty-state";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type ClientDetailNotFoundViewProps = {
  message?: string;
  className?: string;
};

export function ClientDetailNotFoundView({
  message = DISTRIBUTOR_CLIENT_COPY.clientNotFound,
  className,
}: ClientDetailNotFoundViewProps) {
  return (
    <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, className)}>
      <ClientDetailEmptyState message={message} icon={UserRoundX} />
    </div>
  );
}
