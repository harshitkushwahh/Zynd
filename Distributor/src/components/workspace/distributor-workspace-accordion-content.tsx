"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { motion } from "motion/react";

import { DISTRIBUTOR_MENU_EASE } from "@/components/ui/distributor-menu-motion";
import { cn } from "@/lib/utils";

type DistributorWorkspaceAccordionContentProps = AccordionPrimitive.Panel.Props & {
  open: boolean;
};

function WorkspaceAccordionPanelBody({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={className}
      initial={false}
      animate={open ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [...DISTRIBUTOR_MENU_EASE] }}
    >
      {children}
    </motion.div>
  );
}

export function DistributorWorkspaceAccordionContent({
  open,
  className,
  children,
  ...props
}: DistributorWorkspaceAccordionContentProps) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      keepMounted
      className={cn(
        "distributor-workspace-sidebar__accordion-panel h-(--accordion-panel-height) overflow-hidden text-compact data-ending-style:h-0 data-starting-style:h-0",
      )}
      {...props}
    >
      <WorkspaceAccordionPanelBody
        open={open}
        className={cn("distributor-workspace-sidebar__section-children", className)}
      >
        {children}
      </WorkspaceAccordionPanelBody>
    </AccordionPrimitive.Panel>
  );
}
