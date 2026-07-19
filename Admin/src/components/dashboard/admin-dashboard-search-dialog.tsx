"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpRight } from "lucide-react";

import {
  AdminDialog,
  AdminDialogContent,
} from "@/components/ui/admin-dialog";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { cn } from "@/lib/utils";
import {
  getVisibleAdminRoutes,
  type AdminNavRoute,
} from "@/lib/admin-navigation";
import { useAdminAuth } from "@/contexts/admin-auth-context";

type AdminDashboardSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdminDashboardSearchDialog({
  open,
  onOpenChange,
}: AdminDashboardSearchDialogProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const [query, setQuery] = useState("");
  const routes = useMemo(() => getVisibleAdminRoutes(hasPermission), [hasPermission]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return routes;
    return routes.filter(
      (route) =>
        route.label.toLowerCase().includes(normalized) ||
        route.description?.toLowerCase().includes(normalized) ||
        route.href.toLowerCase().includes(normalized),
    );
  }, [query, routes]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const navigate = (route: AdminNavRoute) => {
    onOpenChange(false);
    if (route.external) {
      window.open(route.href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(route.href);
  };

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange}>
      <AdminDialogContent size="md" align="top" className="gap-0 p-0">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
          <AdminSearchInput
            bare
            showIcon={false}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search admin pages..."
            containerClassName="min-w-0 flex-1"
          />
        </div>
        <div className="max-h-scroll-md overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-compact text-muted-foreground">
              No pages match your search.
            </p>
          ) : (
            filtered.map((route) => {
              const Icon = route.icon;
              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => navigate(route)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-muted",
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-compact font-medium text-foreground">
                      {route.label}
                    </span>
                    {route.description ? (
                      <span className="block text-caption text-muted-foreground">
                        {route.description}
                      </span>
                    ) : null}
                  </span>
                  {route.showTrailingArrow ? (
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </AdminDialogContent>
    </AdminDialog>
  );
}
