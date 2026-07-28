"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DUMMY_AUDIT_LOGS,
  type SupportAuditAction,
} from "@/lib/dummy/audit-logs";
import { formatSupportDateTime } from "@/lib/format";
import { labelize } from "@/lib/status-meta";

const ACTION_FILTERS: Array<"all" | SupportAuditAction> = [
  "all",
  "ticket.viewed",
  "ticket.replied",
  "ticket.status_changed",
  "ticket.assigned",
  "user.viewed",
  "login",
];

export function SupportAuditLogsPanel() {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<(typeof ACTION_FILTERS)[number]>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DUMMY_AUDIT_LOGS.filter((log) => {
      if (action !== "all" && log.action !== action) return false;
      if (!q) return true;
      return (
        log.actorName.toLowerCase().includes(q) ||
        log.targetLabel.toLowerCase().includes(q) ||
        log.detail.toLowerCase().includes(q) ||
        log.targetId.toLowerCase().includes(q)
      );
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [action, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-h3 font-semibold text-foreground">Audit logs</h1>
        <p className="mt-1 text-caption text-muted-foreground">
          Agent and system actions for the support console (dummy trail).
        </p>
      </div>

      <div className="space-y-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search actor, target, or detail…"
          className="sm:max-w-sm"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ACTION_FILTERS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={action === value ? "default" : "outline"}
              className="shrink-0 capitalize"
              onClick={() => setAction(value)}
            >
              {value === "all" ? "All" : labelize(value.replace(".", " · "))}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-compact">
              <thead className="border-b border-border bg-muted/30 text-caption text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatSupportDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium">{log.actorName}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      {labelize(log.action.replace(".", " · "))}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{log.targetLabel}</p>
                      <p className="text-caption text-muted-foreground">
                        {log.targetType} · {log.targetId}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-caption text-muted-foreground">
              No audit events match this filter.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
