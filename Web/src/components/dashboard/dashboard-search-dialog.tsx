"use client";

import { useRouter } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type DashboardSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DashboardSearchDialog({
  open,
  onOpenChange,
}: DashboardSearchDialogProps) {
  const router = useRouter();
  const navRoutes = DASHBOARD_ROUTES.filter((route) => route.enabled);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search dashboard"
      description="Search pages across your dashboard."
    >
      <CommandInput placeholder="Search pages..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {navRoutes.map((route) => {
            const Icon = route.icon;

            return (
              <CommandItem
                key={route.id}
                value={route.label}
                onSelect={() => {
                  router.push(route.href);
                  onOpenChange(false);
                }}
              >
                <Icon />
                <span>{route.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
