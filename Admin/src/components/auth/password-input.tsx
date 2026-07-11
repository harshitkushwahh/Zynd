"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  icon?: LucideIcon;
};

export function PasswordInput({ className, icon: Icon, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {Icon ? (
        <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      ) : null}
      <Input
        type={visible ? "text" : "password"}
        className={cn(Icon ? "h-10 pl-9 pr-[4.75rem]" : "pr-[4.75rem]", className)}
        {...props}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute top-1/2 right-3 inline-flex -translate-y-1/2 items-center gap-1 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? (
          <>
            <EyeOff className="size-3.5" aria-hidden />
            Hide
          </>
        ) : (
          <>
            <Eye className="size-3.5" aria-hidden />
            Show
          </>
        )}
      </button>
    </div>
  );
}
