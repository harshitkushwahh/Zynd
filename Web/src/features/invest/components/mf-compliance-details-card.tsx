"use client";

import { useMemo } from "react";
import { Scale } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { copy } from "@/shared/config/copy";
import type { InvestFundDetail } from "@/features/invest/api/invest-api";
import { MF_FUND_DETAIL_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
import { cn } from "@/lib/utils";

type ComplianceData = NonNullable<InvestFundDetail["compliance"]>;

type ComplianceBullet = {
  title: string;
  body: string;
};

function buildComplianceBullets(compliance: ComplianceData): ComplianceBullet[] {
  const bullets: ComplianceBullet[] = [];

  if (compliance.exit_load?.text?.trim()) {
    bullets.push({
      title: copy.mutualFunds.complianceExitLoadTitle,
      body: compliance.exit_load.text.trim(),
    });
  }

  if (compliance.stamp_duty_pct != null) {
    bullets.push({
      title: copy.mutualFunds.complianceStampDutyTitle,
      body:
        compliance.tax_implication?.stamp_duty_note?.trim() ??
        `${compliance.stamp_duty_pct}% on investment`,
    });
  }

  compliance.tax_implication?.sections?.forEach((section) => {
    const title = section.title?.trim();
    const body = section.body?.trim();
    if (!title && !body) return;
    bullets.push({
      title: title || copy.mutualFunds.complianceDetailsTitle,
      body: body ?? "",
    });
  });

  if (compliance.lock_in_days != null && compliance.lock_in_days > 0) {
    bullets.push({
      title: copy.mutualFunds.complianceLockInTitle,
      body:
        compliance.lock_in_days === 1
          ? "1 day"
          : `${compliance.lock_in_days.toLocaleString("en-IN")} days`,
    });
  }

  return bullets.filter((bullet) => bullet.body.length > 0);
}

type MfComplianceDetailsCardProps = {
  compliance: ComplianceData;
};

export function MfComplianceDetailsCard({ compliance }: MfComplianceDetailsCardProps) {
  const bullets = useMemo(() => buildComplianceBullets(compliance), [compliance]);

  if (bullets.length === 0) return null;

  return (
    <Card className={cn("overflow-hidden border border-border", MF_FUND_DETAIL_RADIUS_CLASS)}>
      <Accordion className="w-full">
        <AccordionItem value="compliance" className="border-b-0">
          <AccordionTrigger className="rounded-none px-4 py-4 hover:bg-muted/20">
            <div className="sip-icon-badge flex size-9 shrink-0 items-center justify-center rounded-full">
              <Scale className="size-4" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-medium text-foreground">{copy.mutualFunds.complianceDetailsTitle}</p>
              <p className="mt-0.5 text-caption text-muted-foreground group-data-[panel-open]:hidden">
                {copy.mutualFunds.complianceDetailsDescription}
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border/60 px-4">
            <ul className="list-disc space-y-3 py-4 pl-5 text-compact leading-relaxed text-muted-foreground marker:text-primary/70">
              {bullets.map((bullet, index) => (
                <li key={`${bullet.title}-${index}`}>
                  <span className="font-medium text-foreground">{bullet.title}</span>
                  <span className="mt-1 block">{bullet.body}</span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

export function shouldShowComplianceDetails(fund: InvestFundDetail) {
  if (!fund.compliance) return false;
  return buildComplianceBullets(fund.compliance).length > 0;
}
