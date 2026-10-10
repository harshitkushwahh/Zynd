"use client";

import { useMemo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { FileJson } from "lucide-react";

import { ClientKycPayloadFieldCards } from "@/components/clients/client-kyc-payload-field-cards";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { buildKycPayloadDisplay } from "@/lib/kyc-payload-fields";
import {
  DISTRIBUTOR_INSET_SECTION_BODY_CLASS,
  DISTRIBUTOR_LABEL_CAPS_TINY_CLASS,
  DISTRIBUTOR_OVERLAY_HEADER_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

export type ClientKycPayloadMetaRow = {
  label: string;
  value: ReactNode;
};

type ClientKycPayloadViewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  metaRows?: ClientKycPayloadMetaRow[];
  payload: Record<string, unknown>;
};

function MetaRow({ label, value }: ClientKycPayloadMetaRow) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
      <dt className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>{label}</dt>
      <dd className="min-w-0 text-compact text-foreground">{value}</dd>
    </div>
  );
}

export function ClientKycPayloadViewDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon = FileJson,
  metaRows = [],
  payload,
}: ClientKycPayloadViewDialogProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.kyc;
  const display = useMemo(() => buildKycPayloadDisplay(payload), [payload]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description ?? copy.payloadDialogDescription}</DialogDescription>
      </DialogHeader>
      <DialogContent className="support-kyc-payload-dialog max-w-lg gap-0 bg-card p-0 sm:max-w-2xl dark:bg-card">
        <div className={cn(DISTRIBUTOR_OVERLAY_HEADER_CLASS, "support-kyc-payload-dialog__header")}>
          <div className="flex items-start gap-3">
            <span
              className="support-kyc-payload-dialog__icon flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]"
              aria-hidden
            >
              <Icon className="size-4" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <h2 className="text-compact font-semibold">{title}</h2>
              <p className="distributor-panel-card__description">
                {description ?? copy.payloadDialogDescription}
              </p>
            </div>
          </div>
        </div>
        <div
          className={cn(
            DISTRIBUTOR_INSET_SECTION_BODY_CLASS,
            "support-kyc-payload-dialog__body max-h-[min(60vh,28rem)] overflow-y-auto",
          )}
        >
          {metaRows.length > 0 ? (
            <dl className="mb-4 flex flex-col gap-3 border-b border-border pb-4">
              {metaRows.map((row) => (
                <MetaRow key={row.label} label={row.label} value={row.value} />
              ))}
            </dl>
          ) : null}
          <ClientKycPayloadFieldCards display={display} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
