"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  fetchExternalHoldings,
  type MfExternalHolding,
} from "@/features/invest/api/invest-api";
import { formatDate, formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";

function HoldingRow({ holding }: { holding: MfExternalHolding }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {holding.matched_scheme_name ?? holding.scheme_name}
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          {holding.amc_name ?? copy.mutualFunds.unknownAmc}
          {holding.folio_number ? ` · Folio ${holding.folio_number}` : ""}
        </p>
      </div>
      <div className="sm:text-right">
        <p className="font-medium">{formatInr(holding.market_value_inr)}</p>
        <p className="text-caption text-muted-foreground">
          {holding.units.toFixed(3)} units · {formatDate(holding.as_of_date)}
        </p>
      </div>
    </div>
  );
}

export function MfHoldingsSection() {
  const [holdings, setHoldings] = useState<MfExternalHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHoldings() {
    setLoading(true);
    setError(null);
    try {
      const holdingsResponse = await fetchExternalHoldings();
      setHoldings(holdingsResponse.external_holdings);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mutualFunds.holdingsLoadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHoldings();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{copy.mutualFunds.holdingsTitle}</CardTitle>
            <CardDescription>{copy.mutualFunds.holdingsDescription}</CardDescription>
          </div>
          <Button variant="outline" disabled>
            <RefreshCw className="size-4" />
            {copy.mutualFunds.casImportCta}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldMessage variant="info" message={copy.mutualFunds.casDisabled} />
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {copy.mutualFunds.loadingHoldings}
            </div>
          ) : null}
          {error ? <FieldMessage variant="error" message={error} /> : null}
          {!loading && !error && holdings.length === 0 ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border px-6 text-center">
              <p className="text-compact text-muted-foreground">{copy.mutualFunds.holdingsEmpty}</p>
            </div>
          ) : null}
          {holdings.map((holding) => (
            <HoldingRow key={`${holding.isin}-${holding.folio_number}`} holding={holding} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
