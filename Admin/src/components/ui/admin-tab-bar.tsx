"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type AdminTabBarVariant = "primary" | "secondary";

type AdminTabListProps = Omit<React.ComponentProps<typeof TabsList>, "variant"> & {
  variant?: AdminTabBarVariant;
  layout?: "horizontal" | "vertical";
};

export function AdminTabList({
  variant = "primary",
  layout = "horizontal",
  className,
  ...props
}: AdminTabListProps) {
  return (
    <TabsList
      variant="default"
      className={cn(
        "admin-tab-list h-auto bg-transparent p-0 shadow-none",
        layout === "horizontal" && "!rounded-full",
        variant === "primary" && "admin-tab-list--primary",
        variant === "secondary" && "admin-tab-list--secondary",
        layout === "vertical" && "admin-tab-list--vertical",
        className,
      )}
      {...props}
    />
  );
}

type AdminTabTriggerProps = React.ComponentProps<typeof TabsTrigger>;

export function AdminTabTrigger({ className, ...props }: AdminTabTriggerProps) {
  return (
    <TabsTrigger
      className={cn(
        "admin-tab-trigger flex-none shadow-none data-active:shadow-none",
        className,
      )}
      {...props}
    />
  );
}
