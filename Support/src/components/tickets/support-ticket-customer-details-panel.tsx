"use client";

import Link from "next/link";
import { ArrowUpRight, Mail, Phone } from "lucide-react";

import { SupportTicketDetailField } from "@/components/tickets/support-ticket-detail-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDisplayInitials } from "@/lib/get-display-initials";
import { DISTRIBUTOR_LABEL_CAPS_TINY_CLASS } from "@/lib/distributor-layout";
import type { SupportTicketCustomerSnapshot } from "@/lib/support-types";
import { cn } from "@/lib/utils";

type SupportTicketCustomerDetailsPanelProps = {
  customer: SupportTicketCustomerSnapshot;
  clientCode: string;
  className?: string;
};

export function SupportTicketCustomerDetailsPanel({
  customer,
  clientCode,
  className,
}: SupportTicketCustomerDetailsPanelProps) {
  const userHref = `/dashboard/users/${encodeURIComponent(clientCode)}`;
  const initials = getDisplayInitials(customer.displayName);

  return (
    <Card className={cn("flex h-full min-h-0 flex-col overflow-hidden shadow-sm", className)}>
      <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
        <div className="border-b border-border/60 bg-muted/15 px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="size-16 border border-border/80 shadow-zynd-low">
                <AvatarFallback className="bg-primary/10 text-h3 font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="font-heading text-h3 font-semibold text-foreground">
                  {customer.displayName}
                </h2>
                <p className="mt-1 font-mono text-caption text-muted-foreground">{clientCode}</p>
                <div className="mt-2">
                  <StatusBadge variant={customer.kycCompliant ? "success" : "destructive"} showIcon={false}>
                    {customer.kycStatusLabel}
                  </StatusBadge>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={userHref} />}
            >
              Open full profile
              <ArrowUpRight className="size-3.5" strokeWidth={2.25} aria-hidden />
            </Button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section>
            <h3 className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>Contact</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
                <Phone className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.25} />
                <div className="min-w-0">
                  <p className="text-caption text-muted-foreground">Mobile</p>
                  <p className="text-compact font-medium tabular-nums">{customer.mobileMasked}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
                <Mail className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.25} />
                <div className="min-w-0">
                  <p className="text-caption text-muted-foreground">Email</p>
                  <p className="truncate text-compact font-medium">{customer.emailMasked}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border/60 bg-muted/10">
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <h3 className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>Identity & compliance</h3>
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
                <SupportTicketDetailField label="PAN">{customer.panMasked}</SupportTicketDetailField>
                <SupportTicketDetailField label="Aadhaar">{customer.aadhaarMasked}</SupportTicketDetailField>
                <SupportTicketDetailField label="KYC status">
                  <StatusBadge variant={customer.kycCompliant ? "success" : "destructive"} showIcon={false}>
                    {customer.kycStatusLabel}
                  </StatusBadge>
                </SupportTicketDetailField>
              </dl>
            </div>
            <div className="border-t border-border/60 px-4 py-4 sm:px-5 sm:py-5">
              <h3 className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>Account</h3>
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
                <SupportTicketDetailField label="Client type">{customer.clientType}</SupportTicketDetailField>
                <SupportTicketDetailField label="Onboarding date">{customer.onboardingDate}</SupportTicketDetailField>
                <SupportTicketDetailField label="Client code">
                  <Link href={userHref} className="font-mono text-primary hover:underline">
                    {clientCode}
                  </Link>
                </SupportTicketDetailField>
              </dl>
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
