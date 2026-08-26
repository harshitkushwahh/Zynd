"use client";

import {
  ArrowDownLeft,
  CalendarClock,
  CheckCircle2,
  Layers,
  Layers3,
  PauseCircle,
  Repeat,
  XCircle,
} from "lucide-react";

import type { ClientActivitySubTabId } from "@/components/clients/client-activity-sub-tab-ids";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
} from "@/lib/distributor-layout";
import type { DistributorOrder, DistributorSystematicPlan } from "@/lib/distributor-types";
import { getYourOrdersOperationMix } from "@/lib/your-operations-dual-ring";
import { cn } from "@/lib/utils";

type ClientActivityMetricsTilesProps = {
  subTab: ClientActivitySubTabId;
  sips: DistributorSystematicPlan[];
  orders: DistributorOrder[];
  className?: string;
};

export function ClientActivityMetricsTiles({
  subTab,
  sips,
  orders,
  className,
}: ClientActivityMetricsTilesProps) {
  const clientHint = "For this client";
  const activeSipCount = sips.filter((p) => p.status === "Active").length;
  const pausedSipCount = sips.filter((p) => p.status === "Paused").length;
  const cancelledSipCount = sips.filter((p) => p.status === "Cancelled").length;
  const orderMix = getYourOrdersOperationMix(orders);

  return (
    <div className={cn(DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS, className)}>
      {subTab === "sips" ? (
        <>
          <DistributorMetricCard
            className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
            variant="tile"
            tileTone="accent"
            icon={CalendarClock}
            label="Total SIPs"
            value={String(sips.length)}
            hint={clientHint}
            showTileAction={false}
          />
          <DistributorMetricCard
            className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
            variant="tile"
            icon={CheckCircle2}
            label="Active"
            value={String(activeSipCount)}
            hint="Currently running"
            showTileAction={false}
          />
          <DistributorMetricCard
            className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
            variant="tile"
            icon={PauseCircle}
            label="Paused"
            value={String(pausedSipCount)}
            hint="Temporarily stopped"
            showTileAction={false}
          />
          <DistributorMetricCard
            className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
            variant="tile"
            icon={XCircle}
            label="Cancelled"
            value={String(cancelledSipCount)}
            hint="Closed plans"
            showTileAction={false}
          />
        </>
      ) : (
        <>
          <DistributorMetricCard
            className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
            variant="tile"
            tileTone="accent"
            icon={Layers3}
            label="Total orders"
            value={String(orderMix.total)}
            hint={clientHint}
            showTileAction={false}
          />
          <DistributorMetricCard
            className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
            variant="tile"
            icon={Layers}
            label="One time"
            value={String(orderMix.oneTime)}
            hint="Lumpsum & switch"
            showTileAction={false}
          />
          <DistributorMetricCard
            className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
            variant="tile"
            icon={Repeat}
            label="SIP"
            value={String(orderMix.sip)}
            hint="Installment orders"
            showTileAction={false}
          />
          <DistributorMetricCard
            className={DISTRIBUTOR_METRIC_TILE_CELL_CLASS}
            variant="tile"
            icon={ArrowDownLeft}
            label="Redemption"
            value={String(orderMix.redemption)}
            hint="Redeem orders"
            showTileAction={false}
          />
        </>
      )}
    </div>
  );
}
