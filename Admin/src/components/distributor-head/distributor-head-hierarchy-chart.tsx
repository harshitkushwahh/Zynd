"use client";

import {
  ArrowDown,
  Building2,
  Crown,
  Mail,
  MapPin,
  Network,
  Users2,
} from "lucide-react";

import {
  DistributorHeadChipBadge,
  DistributorHeadStatusBadge,
  DistributorHeadStepBadge,
} from "@/components/distributor-head/distributor-head-badge";
import {
  DUMMY_BRANCHES,
  DUMMY_DISTRIBUTORS,
  DUMMY_MANAGERS,
  DUMMY_STATE_HEAD,
  type DistributorHeadManager,
} from "@/lib/dummy/distributor-head-data";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";
import { cn } from "@/lib/utils";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
}

function JourneyConnector() {
  return (
    <li className="distributor-head-journey-connector" aria-hidden>
      <span className="distributor-head-journey-connector__line" />
      <ArrowDown className="distributor-head-journey-connector__icon size-4" strokeWidth={2} />
      <span className="distributor-head-journey-connector__line" />
    </li>
  );
}

function ManagerJourneyCard({ manager }: { manager: DistributorHeadManager }) {
  const branchNames = DUMMY_BRANCHES.filter((b) => b.managerId === manager.id).map((b) => b.name);

  return (
    <article className="distributor-head-journey-manager">
      <div className="flex items-start gap-2.5">
        <div className="distributor-head-journey-avatar">{initialsFromName(manager.name)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug text-foreground">{manager.name}</p>
            <DistributorHeadStatusBadge status={manager.status} className="shrink-0" />
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-caption text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            {manager.city}
          </p>
        </div>
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-2 text-caption">
        <div>
          <dt className="text-muted-foreground">Distributors</dt>
          <dd className="font-semibold tabular-nums text-foreground">{manager.distributorCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sales MTD</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {formatDistributorHeadInr(manager.salesMtdInr)}
          </dd>
        </div>
      </dl>
      {branchNames.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1">
          {branchNames.map((name) => (
            <li key={name}>
              <DistributorHeadChipBadge className="text-muted-foreground">
                <Building2 className="size-2.5 opacity-70" />
                {name}
              </DistributorHeadChipBadge>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function DistributorHeadHierarchyChart({ className }: { className?: string }) {
  const activeDistributors = DUMMY_DISTRIBUTORS.filter((d) => d.status === "Active").length;
  const totalDistributorCount = DUMMY_MANAGERS.reduce((sum, m) => sum + m.distributorCount, 0);

  return (
    <ol className={cn("distributor-head-journey", className)}>
      <li className="distributor-head-journey-step">
        <div className="distributor-head-journey-step__rail">
          <DistributorHeadStepBadge step={1} />
        </div>
        <div className="distributor-head-journey-step__body">
          <p className="distributor-head-journey-step__title">State head</p>
          <div className="distributor-head-journey-head">
            <div className="distributor-head-journey-head__icon">
              <Crown className="size-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-base font-semibold text-foreground">
                {DUMMY_STATE_HEAD.name}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-caption text-muted-foreground">
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{DUMMY_STATE_HEAD.email}</span>
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-caption text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                {DUMMY_STATE_HEAD.state} · {DUMMY_STATE_HEAD.stateCode}
              </p>
            </div>
          </div>
        </div>
      </li>

      <JourneyConnector />

      <li className="distributor-head-journey-step">
        <div className="distributor-head-journey-step__rail">
          <DistributorHeadStepBadge step={2} />
        </div>
        <div className="distributor-head-journey-step__body">
          <p className="distributor-head-journey-step__title">
            Branch managers
            <span className="font-normal text-muted-foreground"> · {DUMMY_MANAGERS.length}</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DUMMY_MANAGERS.map((manager) => (
              <ManagerJourneyCard key={manager.id} manager={manager} />
            ))}
          </div>
        </div>
      </li>

      <JourneyConnector />

      <li className="distributor-head-journey-step">
        <div className="distributor-head-journey-step__rail">
          <DistributorHeadStepBadge step={3} />
        </div>
        <div className="distributor-head-journey-step__body">
          <p className="distributor-head-journey-step__title">Distributor network</p>
          <div className="distributor-head-journey-network">
            <div className="distributor-head-journey-network__stat">
              <Network className="size-4 text-primary" />
              <div>
                <p className="text-micro text-muted-foreground">Active distributors</p>
                <p className="text-sm font-semibold tabular-nums">
                  {activeDistributors}{" "}
                  <span className="font-normal text-muted-foreground">/ {DUMMY_DISTRIBUTORS.length} listed</span>
                </p>
              </div>
            </div>
            <div className="distributor-head-journey-network__stat">
              <Users2 className="size-4 text-primary" />
              <div>
                <p className="text-micro text-muted-foreground">Under managers (rollup)</p>
                <p className="text-sm font-semibold tabular-nums">{totalDistributorCount}</p>
              </div>
            </div>
            <div className="distributor-head-journey-network__stat">
              <Building2 className="size-4 text-primary" />
              <div>
                <p className="text-micro text-muted-foreground">Branches in state</p>
                <p className="text-sm font-semibold tabular-nums">{DUMMY_BRANCHES.length}</p>
              </div>
            </div>
          </div>
        </div>
      </li>
    </ol>
  );
}
