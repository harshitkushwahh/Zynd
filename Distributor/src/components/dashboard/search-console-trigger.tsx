"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SearchConsoleTriggerProps = {
  onOpen: () => void;
  /** Wider field when shown in the navbar left cluster (investor lists). */
  variant?: "default" | "leading";
};

export function SearchConsoleTrigger({
  onOpen,
  variant: _variant = "default",
}: SearchConsoleTriggerProps) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="distributor-search-console-trigger hidden w-52 justify-start text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 md:inline-flex lg:w-60"
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
