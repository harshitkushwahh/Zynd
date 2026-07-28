"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  distributorOperationsSectionHref,
  getDistributorOperationsSections,
  type DistributorOperationsSectionId,
} from "@/lib/distributor-operations-sections";
import {
  getDistributorOperationsVariants,
  isDistributorOperationsVariantActive,
  parseYourOperationsPathname,
} from "@/lib/distributor-operations-variants";
import {
  DISTRIBUTOR_LABEL_CAPS_CLASS,
  DISTRIBUTOR_WORKSPACE_NAV_ITEM_ACTIVE_CLASS,
  DISTRIBUTOR_WORKSPACE_NAV_ITEM_CLASS,
  DISTRIBUTOR_WORKSPACE_NAV_ITEM_DISABLED_CLASS,
  DISTRIBUTOR_WORKSPACE_SIDEBAR_CLASS,
  DISTRIBUTOR_WORKSPACE_SIDEBAR_HEADER_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

export function YourOperationsSidebar() {
  const pathname = usePathname();
  const sections = getDistributorOperationsSections();
  const { sectionId: activeSectionId } = parseYourOperationsPathname(pathname);
  const openSections = activeSectionId ? [activeSectionId] : ["orders"];

  return (
    <aside className={DISTRIBUTOR_WORKSPACE_SIDEBAR_CLASS}>
      <div className={DISTRIBUTOR_WORKSPACE_SIDEBAR_HEADER_CLASS}>
        <p className={cn(DISTRIBUTOR_LABEL_CAPS_CLASS, "font-semibold")}>Operations</p>
      </div>
      <Accordion className="px-2 py-2" defaultValue={openSections} key={activeSectionId ?? "none"}>
        {sections.map((item) => {
          const Icon = item.icon;
          const sectionId = item.id as DistributorOperationsSectionId;
          const variants = getDistributorOperationsVariants(sectionId);
          const sectionActive = activeSectionId === sectionId;

          return (
            <AccordionItem key={item.id} value={item.id} className="border-border/70">
              <AccordionTrigger
                className={cn(sectionActive && "text-foreground")}
                aria-label={`${item.label} types`}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.25} />
                <span className="min-w-0 truncate">{item.label}</span>
              </AccordionTrigger>
              <AccordionContent className="px-1">
                <ul className="flex flex-col gap-0.5 pb-1 pl-2">
                  {variants.map((variant) => {
                    const active = isDistributorOperationsVariantActive(
                      pathname,
                      sectionId,
                      variant.id,
                    );

                    return (
                      <li key={variant.id} className="list-none">
                        {variant.dividerBefore ? (
                          <div
                            className="flex items-center gap-2 py-2 pl-1 pr-2"
                            aria-hidden
                          >
                            <span className="h-px min-w-0 flex-1 bg-border" />
                            <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                            <span className="h-px min-w-0 flex-1 bg-border" />
                          </div>
                        ) : null}

                        {variant.disabled ? (
                          <span className={DISTRIBUTOR_WORKSPACE_NAV_ITEM_DISABLED_CLASS} aria-disabled>
                            {variant.label}
                          </span>
                        ) : (
                          <Link
                            href={distributorOperationsSectionHref(sectionId, variant.id)}
                            className={
                              active
                                ? DISTRIBUTOR_WORKSPACE_NAV_ITEM_ACTIVE_CLASS
                                : DISTRIBUTOR_WORKSPACE_NAV_ITEM_CLASS
                            }
                            aria-current={active ? "page" : undefined}
                          >
                            {variant.label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </aside>
  );
}
