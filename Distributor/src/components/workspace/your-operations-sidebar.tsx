"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Accordion, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DistributorWorkspaceAccordionContent } from "@/components/workspace/distributor-workspace-accordion-content";
import { useDistributorOrders } from "@/contexts/distributor-orders-context";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import { getOperationsVariantCountMap } from "@/lib/distributor-operations-variant-counts";
import {
  getDistributorOperationsSections,
  type DistributorOperationsSectionId,
} from "@/lib/distributor-operations-sections";
import {
  buildYourOperationsVariantHref,
  resolveDistributorOrdersListScope,
} from "@/lib/distributor-operations-orders-scope";
import {
  getDistributorOperationsVariants,
  isDistributorOperationsVariantActive,
  parseYourOperationsPathname,
} from "@/lib/distributor-operations-variants";
import {
  DISTRIBUTOR_LABEL_CAPS_CLASS,
  DISTRIBUTOR_WORKSPACE_NAV_ITEM_ACTIVE_CLASS,
  DISTRIBUTOR_WORKSPACE_NAV_ITEM_CLASS,
  DISTRIBUTOR_WORKSPACE_NAV_ITEM_COUNT_CLASS,
  DISTRIBUTOR_WORKSPACE_NAV_ITEM_DISABLED_CLASS,
  DISTRIBUTOR_WORKSPACE_SIDEBAR_ACCORDION_CLASS,
  DISTRIBUTOR_WORKSPACE_SIDEBAR_CLASS,
  DISTRIBUTOR_WORKSPACE_SIDEBAR_HEADER_CLASS,
  DISTRIBUTOR_WORKSPACE_SIDEBAR_NAV_CLASS,
  DISTRIBUTOR_WORKSPACE_SIDEBAR_SECTION_CLASS,
  DISTRIBUTOR_WORKSPACE_SIDEBAR_SECTION_TRIGGER_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

export function YourOperationsSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sections = getDistributorOperationsSections();
  const { sectionId: activeSectionId } = parseYourOperationsPathname(pathname);
  const operationsListScope = resolveDistributorOrdersListScope(searchParams.get("ordersScope"));
  const { requests: txnRequests, transactionGroups } = useDistributorTxnRequests();
  const { bookOrders, allOrders } = useDistributorOrders();
  const scopedOrders = operationsListScope === "all" ? allOrders : bookOrders;

  const variantCountsBySection = useMemo(() => {
    const sectionIds: DistributorOperationsSectionId[] = [
      "orders",
      "systematic-plans",
      "txn-requests",
      "transaction-groups",
    ];
    return Object.fromEntries(
      sectionIds.map((id) => [
        id,
        getOperationsVariantCountMap(id, operationsListScope, txnRequests, transactionGroups, scopedOrders),
      ]),
    ) as Record<DistributorOperationsSectionId, Record<string, number>>;
  }, [operationsListScope, scopedOrders, transactionGroups, txnRequests]);

  const [expandedSections, setExpandedSections] = useState<string[]>(() => [
    activeSectionId ?? "orders",
  ]);

  useEffect(() => {
    if (activeSectionId) {
      setExpandedSections([activeSectionId]);
    }
  }, [activeSectionId]);

  return (
    <aside className={DISTRIBUTOR_WORKSPACE_SIDEBAR_CLASS}>
      <div className={DISTRIBUTOR_WORKSPACE_SIDEBAR_HEADER_CLASS}>
        <p className={cn(DISTRIBUTOR_LABEL_CAPS_CLASS, "font-semibold")}>Operations</p>
      </div>
      <nav className={DISTRIBUTOR_WORKSPACE_SIDEBAR_NAV_CLASS} aria-label="Operations sections">
        <Accordion
          className={DISTRIBUTOR_WORKSPACE_SIDEBAR_ACCORDION_CLASS}
          value={expandedSections}
          onValueChange={(value) => {
            const ids = Array.isArray(value) ? value : value ? [value] : [];
            if (ids.length <= 1) {
              setExpandedSections(
                ids.length > 0 ? ids : activeSectionId ? [activeSectionId] : ["orders"],
              );
              return;
            }
            const newlyOpened = ids.find((id) => !expandedSections.includes(id));
            setExpandedSections(newlyOpened ? [newlyOpened] : [ids[ids.length - 1]!]);
          }}
        >
          {sections.map((item) => {
            const Icon = item.icon;
            const sectionId = item.id as DistributorOperationsSectionId;
            const variants = getDistributorOperationsVariants(sectionId);
            const sectionActive = activeSectionId === sectionId;
            const variantCounts = variantCountsBySection[sectionId] ?? {};
            const sectionOpen = expandedSections.includes(item.id);

            return (
              <AccordionItem
                key={item.id}
                value={item.id}
                className={DISTRIBUTOR_WORKSPACE_SIDEBAR_SECTION_CLASS}
              >
                <AccordionTrigger
                  className={cn(
                    DISTRIBUTOR_WORKSPACE_SIDEBAR_SECTION_TRIGGER_CLASS,
                    sectionActive && "distributor-workspace-sidebar__section-trigger--active-section",
                    sectionOpen && "distributor-workspace-sidebar__section-trigger--open",
                  )}
                  aria-label={`${item.label} types`}
                >
                  <Icon className="distributor-workspace-sidebar__section-icon" strokeWidth={2.25} />
                  <span className="distributor-workspace-sidebar__section-label">{item.label}</span>
                </AccordionTrigger>
                <DistributorWorkspaceAccordionContent open={sectionOpen}>
                  <ul className="distributor-workspace-sidebar__variant-list">
                    {variants.map((variant) => {
                      const active = isDistributorOperationsVariantActive(
                        pathname,
                        sectionId,
                        variant.id,
                      );

                      return (
                        <li key={variant.id} className="distributor-workspace-sidebar__variant-item">
                          {variant.dividerBefore ? (
                            <div
                              className="distributor-workspace-sidebar__variant-divider"
                              aria-hidden
                            >
                              <span className="distributor-workspace-sidebar__variant-divider-line" />
                              <span className="distributor-workspace-sidebar__variant-divider-dot" />
                              <span className="distributor-workspace-sidebar__variant-divider-line" />
                            </div>
                          ) : null}

                          {variant.disabled ? (
                            <span
                              className={DISTRIBUTOR_WORKSPACE_NAV_ITEM_DISABLED_CLASS}
                              aria-disabled
                            >
                              <span className="distributor-workspace-nav-item__label">
                                {variant.label}
                              </span>
                              <span
                                className={DISTRIBUTOR_WORKSPACE_NAV_ITEM_COUNT_CLASS}
                                aria-hidden
                              >
                                {variantCounts[variant.id] ?? 0}
                              </span>
                            </span>
                          ) : (
                            <Link
                              href={buildYourOperationsVariantHref(
                                sectionId,
                                variant.id,
                                operationsListScope,
                              )}
                              className={
                                active
                                  ? DISTRIBUTOR_WORKSPACE_NAV_ITEM_ACTIVE_CLASS
                                  : DISTRIBUTOR_WORKSPACE_NAV_ITEM_CLASS
                              }
                              aria-current={active ? "page" : undefined}
                            >
                              <span className="distributor-workspace-nav-item__label">
                                {variant.label}
                              </span>
                              <span
                                className={DISTRIBUTOR_WORKSPACE_NAV_ITEM_COUNT_CLASS}
                                aria-label={`${variantCounts[variant.id] ?? 0} total`}
                              >
                                {variantCounts[variant.id] ?? 0}
                              </span>
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </DistributorWorkspaceAccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </nav>
    </aside>
  );
}
