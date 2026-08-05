"use client";

import { useRouter } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  distributorClientsSectionHref,
  getDistributorClientsSections,
  type DistributorClientsSectionId,
} from "@/lib/distributor-clients-sections";
import { cn } from "@/lib/utils";

type YourClientsHeaderTabsProps = {
  activeSectionId: DistributorClientsSectionId;
};

const tabTriggerClass = cn(
  "h-auto flex-none rounded-[var(--radius-control)] border-0 px-4 py-2 text-compact font-medium shadow-none",
  "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground",
  "data-active:bg-foreground data-active:text-background",
  "data-active:hover:bg-foreground data-active:hover:text-background",
  "dark:data-active:bg-foreground dark:data-active:text-background",
  "dark:data-active:hover:bg-foreground dark:data-active:hover:text-background",
  "after:hidden",
  "disabled:bg-muted/40 disabled:text-muted-foreground/40 disabled:hover:bg-muted/40 disabled:hover:text-muted-foreground/40",
);

export function YourClientsHeaderTabs({ activeSectionId }: YourClientsHeaderTabsProps) {
  const router = useRouter();
  const sections = getDistributorClientsSections();

  return (
    <Tabs
      value={activeSectionId}
      onValueChange={(value) => {
        const section = sections.find((entry) => entry.id === value);
        if (!section || section.disabled) return;
        router.push(distributorClientsSectionHref(section.id));
      }}
    >
      <TabsList
        variant="default"
        className="h-auto w-full gap-1 rounded-[var(--radius-control)] bg-muted/50 p-1 sm:w-auto"
      >
        {sections.map((section) => (
          <TabsTrigger
            key={section.id}
            value={section.id}
            disabled={section.disabled}
            className={tabTriggerClass}
          >
            {section.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
