"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SearchConsoleTriggerProps = {
  onOpen: () => void;
  /** Wider field when shown in the navbar left cluster (investor lists). */
  variant?: "default" | "leading";
};

export function SearchConsoleTrigger({
  onOpen,
  variant = "default",
}: SearchConsoleTriggerProps) {
  const isLeading = variant === "leading";

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "distributor-search-console-trigger hidden justify-start text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 md:inline-flex",
                isLeading ? "w-52 lg:w-60" : "w-52 lg:w-60",
              )}
              onClick={onOpen}
            >
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-muted-foreground">Search console...</span>
              <kbd className="distributor-search-console-trigger__kbd ml-auto hidden lg:inline">
                ⌘K
              </kbd>
            </Button>
          }
        />
        <TooltipContent side="bottom">Search pages and demo records</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="distributor-search-console-trigger shadow-none focus-visible:ring-0 md:hidden"
              aria-label="Search console"
              onClick={onOpen}
            >
              <Search className="size-4" />
            </Button>
          }
        />
        <TooltipContent side="bottom">Search</TooltipContent>
      </Tooltip>
    </>
  );
}
