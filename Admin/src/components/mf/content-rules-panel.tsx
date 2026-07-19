"use client";

import { useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { GitBranch, Info, Pencil, Plus, ShieldCheck } from "lucide-react";

import {
  CatalogRulesPanel,
  type CatalogRulesPanelHandle,
} from "@/components/mf/catalog-rules-panel";
import {
  ComplianceSettingsPanel,
  type ComplianceSettingsPanelHandle,
} from "@/components/mf/compliance-settings-panel";
import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ContentSection = "compliance" | "rules";

const CONTENT_NAV_ITEMS: Array<{
  value: ContentSection;
  label: string;
  icon: LucideIcon;
}> = [
  {
    value: "compliance",
    label: "Compliance",
    icon: ShieldCheck,
  },
  {
    value: "rules",
    label: "Catalog rules",
    icon: GitBranch,
  },
];

export function ContentRulesPanel({
  canManageContent,
  canManageRules,
  canPublish,
}: {
  canManageContent: boolean;
  canManageRules: boolean;
  canPublish: boolean;
}) {
  const [section, setSection] = useState<ContentSection>("compliance");
  const complianceRef = useRef<ComplianceSettingsPanelHandle>(null);
  const rulesRef = useRef<CatalogRulesPanelHandle>(null);

  const activeItem = useMemo(
    () => CONTENT_NAV_ITEMS.find((item) => item.value === section) ?? CONTENT_NAV_ITEMS[0],
    [section],
  );

  return (
    <Tabs
      value={section}
      onValueChange={(value) => setSection(value as ContentSection)}
      className="space-y-4"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <AdminSectionTitle icon={activeItem.icon}>{activeItem.label}</AdminSectionTitle>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <TabsList
            variant="line"
            className="h-auto w-full shrink-0 justify-end border-b border-border bg-transparent lg:w-fit"
          >
            {CONTENT_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger key={item.value} value={item.value} className="gap-2 px-4 py-2">
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (section === "compliance") {
                complianceRef.current?.openInfoDialog();
              } else {
                rulesRef.current?.openInfoDialog();
              }
            }}
            aria-label={
              section === "compliance"
                ? "View compliance settings info"
                : "View catalog rules info"
            }
          >
            <Info className="size-3.5" />
          </Button>
          {section === "compliance" && canManageContent ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => complianceRef.current?.openEditDialog()}
            >
              <Pencil className="size-3.5" />
              Edit settings
            </Button>
          ) : null}
          {section === "rules" && canManageRules ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => rulesRef.current?.openCreateDialog()}
            >
              <Plus className="size-3.5" />
              Create rule
            </Button>
          ) : null}
        </div>
      </div>

      <TabsContent value="compliance" className="mt-0">
        <ComplianceSettingsPanel ref={complianceRef} canManage={canManageContent} embedded />
      </TabsContent>
      <TabsContent value="rules" className="mt-0">
        <CatalogRulesPanel
          ref={rulesRef}
          canManageRules={canManageRules}
          canPublish={canPublish}
          embedded
        />
      </TabsContent>
    </Tabs>
  );
}
