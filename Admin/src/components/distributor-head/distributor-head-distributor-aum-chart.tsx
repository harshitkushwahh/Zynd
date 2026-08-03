"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DistributorHeadAumTrendPoint } from "@/lib/dummy/distributor-head-data";
import { formatDistributorHeadInr } from "@/lib/distributor-head-format";

type DistributorHeadDistributorAumChartProps = {
  points: DistributorHeadAumTrendPoint[];
};

function formatCr(value: number) {
  if (value >= 1_00_00_000) {
    return `₹${(value / 1_00_00_000).toFixed(2)} Cr`;
  }
  return formatDistributorHeadInr(value);
}

export function DistributorHeadDistributorAumChart({
  points,
}: DistributorHeadDistributorAumChartProps) {
  if (points.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">AUM trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-compact text-muted-foreground">No AUM history for this distributor.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">AUM trend</CardTitle>
        <p className="text-caption text-muted-foreground">Six-month book growth</p>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dhAumFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                className="text-micro fill-muted-foreground"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(value: number) => formatCr(value)}
                className="text-micro fill-muted-foreground"
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null;
                  const value = payload[0].value as number;
                  return (
                    <div className="rounded-md border border-border bg-popover px-3 py-2 text-compact shadow-md">
                      <p className="font-medium text-foreground">{label}</p>
                      <p className="text-muted-foreground">{formatCr(value)}</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="aumInr"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#dhAumFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
