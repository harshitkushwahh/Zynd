"use client";

import { useRouter } from "next/navigation";
import { IndianRupee, Layers, Repeat } from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { MfTransactionCheckoutsPanel } from "@/components/mf/mf-transaction-checkouts-panel";
import { MfTransactionSipBatchesPanel } from "@/components/mf/mf-transaction-sip-batches-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAuth } from "@/contexts/admin-auth-context";

type BulkOrderSectionPageProps = {
  tabSlug?: string;
};

const BULK_ORDER_TABS = [
  {
    slug: "lumpsum",
    label: "Lumpsum",
    icon: IndianRupee,
  },
  {
    slug: "sip",
    label: "SIP",
    icon: Repeat,
  },
] as const;

export function BulkOrderSectionPage({ tabSlug }: BulkOrderSectionPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const canRead = hasPermission("mf.transactions.read");
  const canManage = hasPermission("mf.transactions.manage");

  const activeTab =
    BULK_ORDER_TABS.find((tab) => tab.slug === tabSlug) ?? BULK_ORDER_TABS[0];

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Platform" }, { label: "Bulk Order" }]}
      title="Bulk Order"
      description="Cart checkouts with multiple funds — lumpsum payments and SIP batches"
      icon={Layers}
    >
      {!canRead ? (
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view bulk orders.
        </AdminFeedbackMessage>
      ) : (
        <Tabs
          value={activeTab.slug}
          onValueChange={(value) => {
            if (value) router.push(`/dashboard/bulk-order/${value}`);
          }}
          className="space-y-4"
        >
          <TabsList variant="line" className="h-auto w-fit justify-start border-b border-border">
            {BULK_ORDER_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.slug} value={tab.slug} className="gap-2 px-4 py-2.5">
                  <Icon className="size-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="lumpsum">
            <MfTransactionCheckoutsPanel canRead={canRead} />
          </TabsContent>
          <TabsContent value="sip">
            <MfTransactionSipBatchesPanel canRead={canRead} canManage={canManage} />
          </TabsContent>
        </Tabs>
      )}
    </AdminSectionPageShell>
  );
}
