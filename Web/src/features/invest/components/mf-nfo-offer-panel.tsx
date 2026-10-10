"use client";

import Image from "next/image";
import { CalendarDays, ChevronRight, Coins, FileText, Hourglass, Megaphone, Tag, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { InvestFundDetail } from "@/features/invest/api/invest-api";
import { AmcLogo } from "@/features/invest/components/mf-amc-logo";
import { formatDate } from "@/features/invest/lib/mf-format";
import { MF_FUND_DETAIL_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
import nfoIllustration from "../../../../public/nfo.png";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfNfoOfferPanelProps = {
  fund: InvestFundDetail;
  onInvest?: () => void;
};

function statusLabel(status: string | null | undefined) {
  return status?.toUpperCase() === "UPCOMING"
    ? copy.mutualFunds.nfoAccordionSoonLabel
    : copy.mutualFunds.nfoAccordionOpenLabel;
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function closingInLabel(closeDate: string | null | undefined) {
  if (!closeDate) return "—";
  const close = parseDateOnly(closeDate);
  if (!close) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  close.setHours(0, 0, 0, 0);
  const days = Math.round((close.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return copy.mutualFunds.nfoClosingClosed;
  if (days === 0) return copy.mutualFunds.nfoClosingToday;
  if (days === 1) return copy.mutualFunds.nfoClosingDay;
  return copy.mutualFunds.nfoClosingDays.replace("{count}", String(days));
}

function MetricChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-black/35 px-3.5 py-3 ring-1 ring-white/10">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
        <Icon className="size-4" strokeWidth={2.25} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-white/55">{label}</p>
        <p className="truncate text-compact font-semibold tabular-nums text-white">{value}</p>
      </div>
    </div>
  );
}

export function MfNfoOfferPanel({ fund, onInvest }: MfNfoOfferPanelProps) {
  const nfo = fund.nfo;
  if (!nfo) return null;

  const closes = nfo.subscription_close_date ? formatDate(nfo.subscription_close_date) : "—";
  const category = fund.content?.risk_label ?? fund.sebi_category;
  const steps = [
    { title: copy.mutualFunds.nfoHowApply, body: copy.mutualFunds.nfoHowApplyBody, icon: FileText },
    { title: copy.mutualFunds.nfoHowAllot, body: copy.mutualFunds.nfoHowAllotBody, icon: Coins },
    { title: copy.mutualFunds.nfoHowList, body: copy.mutualFunds.nfoHowListBody, icon: TrendingUp },
  ];

  return (
    <section
      aria-label={statusLabel(nfo.status)}
      className={cn(
        MF_FUND_DETAIL_RADIUS_CLASS,
        "relative overflow-hidden border border-emerald-500/20 bg-[radial-gradient(120%_140%_at_88%_0%,rgba(52,211,153,0.28)_0%,transparent_42%),linear-gradient(160deg,#052e1f_0%,#07150f_48%,#020617_100%)] text-white shadow-sm",
      )}
    >
      <div className="relative space-y-4 px-4 py-4 sm:px-5">
        <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_10.5rem] lg:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 text-compact font-semibold text-white">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/10">
                <Megaphone className="size-3.5" strokeWidth={2.25} aria-hidden />
              </span>
              {statusLabel(nfo.status)}
            </div>

            <div className="flex min-w-0 items-start gap-3">
              <AmcLogo fund={fund} className="size-12 rounded-2xl bg-white p-1.5" />
              <div className="min-w-0">
                <p className="font-heading text-h3 font-semibold leading-snug text-white">{fund.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/80">
                    {fund.amc_name}
                  </span>
                  {category ? (
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/80">
                      {category}
                    </span>
                  ) : null}
                  {fund.plan_type ? (
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/80">
                      {fund.plan_type}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                    {copy.mutualFunds.nfoBadge}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Image
            src={nfoIllustration}
            alt=""
            className="h-auto w-28 justify-self-end object-contain sm:w-full"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <MetricChip icon={CalendarDays} label={copy.mutualFunds.nfoClosesOnLabel} value={closes} />
          <MetricChip
            icon={Tag}
            label={copy.mutualFunds.nfoOfferPriceLabel}
            value={copy.mutualFunds.nfoOfferPricePerUnit}
          />
          <MetricChip
            icon={Hourglass}
            label={copy.mutualFunds.nfoClosingInLabel}
            value={closingInLabel(nfo.subscription_close_date)}
          />
        </div>

        <div className="rounded-2xl bg-black/30 px-3 py-3 ring-1 ring-white/10 sm:px-4">
          <p className="text-compact font-semibold text-white">{copy.mutualFunds.nfoHowTitle}</p>
          <ol className="mt-3 grid gap-4 sm:grid-cols-3 sm:gap-x-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="min-w-0">
                  <span className="flex size-8 items-center justify-center rounded-full bg-emerald-400 text-emerald-950">
                    <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />
                  </span>
                  <p className="mt-2 text-compact font-semibold text-white">{step.title}</p>
                  <p className="mt-0.5 min-h-[2.5em] whitespace-pre-line text-caption leading-snug text-white/60">
                    {step.body}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        <Button
          type="button"
          className="h-11 w-full bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
          onClick={onInvest}
        >
          {copy.mutualFunds.nfoInvestCta}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}
