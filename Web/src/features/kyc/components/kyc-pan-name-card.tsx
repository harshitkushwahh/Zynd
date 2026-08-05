"use client";

import { CheckCircle2, Loader2, PencilLine, UserRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type PanName = {
  firstName: string;
  lastName: string;
};

type KycPanNameCardProps = {
  isFetched: boolean;
  isFetching: boolean;
  panName: PanName | null;
  middleName: string;
  onFirstNameChange: (value: string) => void;
  onMiddleNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  disabled?: boolean;
  dateOfBirth?: string;
  panCategory?: string;
};

type PanNameFieldProps = {
  label: string;
  value?: string;
  editable?: boolean;
  inputId?: string;
  inputValue?: string;
  inputPlaceholder?: string;
  onInputChange?: (value: string) => void;
  disabled?: boolean;
};

const fieldShellClassName =
  "flex h-9 w-full min-w-0 items-center rounded-[var(--radius-control)] border px-2.5 text-caption transition-colors";

function PanNameField({
  label,
  value,
  editable,
  inputId,
  inputValue,
  inputPlaceholder,
  onInputChange,
  disabled,
}: PanNameFieldProps) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>

      {editable ? (
        <div className="relative">
          <Input
            id={inputId}
            value={inputValue}
            onChange={(event) => onInputChange?.(event.target.value)}
            placeholder={inputPlaceholder}
            autoComplete="additional-name"
            disabled={disabled}
            className={cn(
              fieldShellClassName,
              "bg-background pr-8 font-medium shadow-zynd-low",
              "border-primary/25 placeholder:font-normal placeholder:text-muted-foreground/80",
              "focus-visible:border-primary/45 focus-visible:ring-primary/15",
            )}
          />
          <PencilLine
            className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-primary/55"
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>
      ) : (
        <div
          className={cn(
            fieldShellClassName,
            "border-border/60 bg-muted/35 font-semibold tracking-tight text-foreground",
          )}
        >
          <span className="truncate">{value}</span>
        </div>
      )}
    </div>
  );
}

export function KycPanNameCard({
  isFetched,
  isFetching,
  panName,
  middleName,
  onFirstNameChange,
  onMiddleNameChange,
  onLastNameChange,
  disabled,
  dateOfBirth,
  panCategory,
}: KycPanNameCardProps) {
  const showPending = !isFetched || !panName;

  if (showPending) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-[var(--radius-card)] px-3 py-2.5 transition-colors",
          "border border-dashed border-primary/25 bg-gradient-to-br from-primary/[0.04] via-card to-muted/20 shadow-zynd-low",
        )}
      >
        <div
          className={cn(
            "relative flex size-9 shrink-0 items-center justify-center rounded-full",
            "bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/20",
          )}
        >
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          ) : (
            <UserRound className="size-4" strokeWidth={2} />
          )}
        </div>

        <div className="min-w-0 flex-1 text-left leading-tight">
          <p className="text-caption font-semibold tracking-tight text-foreground">
            {isFetching ? copy.kyc.pan.nameFetchingTitle : copy.kyc.pan.namePendingTitle}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {isFetching ? copy.kyc.pan.nameFetchingDescription : copy.kyc.pan.namePendingDescription}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-[var(--radius-card)] border border-border p-3 shadow-zynd-low",
        "bg-gradient-to-br from-success/[0.05] via-card to-muted/15",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            "bg-success/10 text-success ring-1 ring-inset ring-success/20",
          )}
        >
          <CheckCircle2 className="size-4" strokeWidth={2} />
        </div>

        <div className="min-w-0 pt-0.5">
          <p className="text-caption font-semibold tracking-tight text-foreground">
            {copy.kyc.pan.nameFetchedTitle}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {copy.kyc.pan.nameFetchedDescription}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-2">
        <PanNameField
          label={copy.kyc.pan.firstNameLabel}
          editable
          inputId="kyc-pan-first-name"
          inputValue={panName.firstName}
          inputPlaceholder={copy.kyc.pan.firstNameLabel}
          onInputChange={onFirstNameChange}
          disabled={disabled || isFetching}
        />
        <PanNameField
          label={copy.kyc.pan.middleNameLabel}
          editable
          inputId="kyc-pan-middle-name"
          inputValue={middleName}
          inputPlaceholder={copy.kyc.pan.middleNameInputPlaceholder}
          onInputChange={onMiddleNameChange}
          disabled={disabled || isFetching}
        />
        <PanNameField
          label={copy.kyc.pan.lastNameLabel}
          editable
          inputId="kyc-pan-last-name"
          inputValue={panName.lastName}
          inputPlaceholder={copy.kyc.pan.lastNameLabel}
          onInputChange={onLastNameChange}
          disabled={disabled || isFetching}
        />
      </div>

      {dateOfBirth || panCategory ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-2">
          {dateOfBirth ? (
            <PanNameField label={copy.kyc.pan.dateOfBirthLabel} value={dateOfBirth} />
          ) : null}
          {panCategory ? (
            <PanNameField
              label={copy.kyc.pan.panCategoryLabel}
              value={
                panCategory === "corporate"
                  ? copy.kyc.pan.panCategoryCorporate
                  : copy.kyc.pan.panCategoryIndividual
              }
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
