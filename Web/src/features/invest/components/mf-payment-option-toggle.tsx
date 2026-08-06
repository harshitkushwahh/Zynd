"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type MfPaymentOption<TValue extends string> = {
  id: TValue;
  label: string;
  subtitle?: string;
  icon?: LucideIcon;
  imageSrc?: string;
};

type MfPaymentOptionToggleProps<TValue extends string> = {
  label?: string;
  value: TValue;
  onChange: (value: TValue) => void;
  options: readonly MfPaymentOption<TValue>[];
  disabled?: boolean;
};

export function MfPaymentOptionToggle<TValue extends string>({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: MfPaymentOptionToggleProps<TValue>) {
  return (
    <div className={cn(label ? "space-y-1.5" : undefined)}>
      {label ? (
        <p className="text-caption font-medium text-muted-foreground">{label}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isActive = value === option.id;
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              aria-pressed={isActive}
              onClick={() => onChange(option.id)}
              className={cn(
                "flex gap-2 rounded-[var(--radius-card)] border px-2.5 py-2 text-left transition-colors",
                option.subtitle ? "items-start" : "items-center",
                isActive
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/80 bg-muted/15 hover:border-primary/25 hover:bg-muted/25",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full ring-1",
                  isActive
                    ? "bg-primary/10 text-primary ring-primary/25"
                    : "bg-muted/40 text-muted-foreground ring-border/60",
                  option.imageSrc && "bg-white ring-border/60",
                )}
              >
                {option.imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={option.imageSrc}
                    alt=""
                    className="size-4 object-contain"
                  />
                ) : Icon ? (
                  <Icon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-compact font-medium leading-tight",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {option.label}
                </p>
                {option.subtitle ? (
                  <p className="mt-0.5 truncate text-caption leading-tight text-muted-foreground/80">
                    {option.subtitle}
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
