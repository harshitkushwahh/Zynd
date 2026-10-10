"use client";

import { useMemo, useState } from "react";

import {
  DistributorActivityLogTable,
  type DistributorActivityLogEntry,
} from "@/components/application/activity-log/distributor-activity-log-table";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { SupportFilterSelect } from "@/components/ui/support-filter-select";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { SupportTicketActivityEntry } from "@/lib/support-types";
import { cn } from "@/lib/utils";

function toActivityLogRows(entries: SupportTicketActivityEntry[]): DistributorActivityLogEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    summary: entry.summary,
    actor: entry.actor,
    createdAt: entry.createdAt,
  }));
}

type SupportTicketActivityLogPanelProps = {
  entries: SupportTicketActivityEntry[];
  className?: string;
};

export function SupportTicketActivityLogPanel({
  entries,
  className,
}: SupportTicketActivityLogPanelProps) {
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState<string | "all">("all");

  const rows = useMemo(() => toActivityLogRows(entries), [entries]);

  const actorOptions = useMemo(() => {
    const actors = [...new Set(rows.map((row) => row.actor))].sort((a, b) => a.localeCompare(b));
    return actors.map((actor) => ({ value: actor, label: actor }));
  }, [rows]);

  const filteredByActor = useMemo(() => {
    if (actorFilter === "all") return rows;
    return rows.filter((row) => row.actor === actorFilter);
  }, [actorFilter, rows]);

  const toolbarFilters = (
    <SupportFilterSelect
      label="Actor"
      value={actorFilter}
      options={actorOptions}
      onValueChange={setActorFilter}
    />
  );

  const toolbarSearch = (
    <DistributorTableSearchCard
      variant="card"
      value={search}
      onChange={setSearch}
      placeholder="Search activity…"
      aria-label="Search activity"
    />
  );

  return (
    <DistributorActivityLogTable
      className={cn("h-full", className)}
      entries={filteredByActor}
      search={search}
      onSearchChange={setSearch}
      toolbarFilters={toolbarFilters}
      toolbarSearch={toolbarSearch}
      onToolbarClear={() => {
        setSearch("");
        setActorFilter("all");
      }}
      toolbarClearDisabled={search.trim() === "" && actorFilter === "all"}
      emptyDescription={DISTRIBUTOR_CLIENT_COPY.activity.filtersEmptyDescription}
    />
  );
}
