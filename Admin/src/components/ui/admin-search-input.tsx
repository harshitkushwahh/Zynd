"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AdminSearchInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  containerClassName?: string;
  showIcon?: boolean;
  bare?: boolean;
};

const fieldClassName = {
  default:
    "h-8 border border-border/40 bg-muted/30 pl-8 shadow-none hover:border-border hover:bg-background focus-visible:border-border focus-visible:bg-background focus-visible:ring-0",
  bare:
    "h-auto border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:bg-transparent focus-visible:ring-0",
};

export function AdminSearchInput({
  className,
  containerClassName,
  showIcon = true,
  bare = false,
  ...props
}: AdminSearchInputProps) {
  return (
    <div className={cn("relative w-full", containerClassName)}>
      {showIcon && !bare ? (
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/50"
          aria-hidden
        />
      ) : null}
      <Input
        type="search"
        className={cn(
          "text-compact placeholder:text-muted-foreground/65",
          bare ? fieldClassName.bare : fieldClassName.default,
          className,
        )}
        {...props}
      />
    </div>
  );
}
