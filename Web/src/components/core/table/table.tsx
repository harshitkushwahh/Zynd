"use client";

import type { ComponentPropsWithRef, HTMLAttributes, ReactNode, Ref, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { createContext, isValidElement, useContext } from "react";
import { ArrowDown, ChevronSelectorVertical } from "@untitledui/icons";
import type {
  CellProps as AriaCellProps,
  ColumnProps as AriaColumnProps,
  RowProps as AriaRowProps,
  TableHeaderProps as AriaTableHeaderProps,
  TableProps as AriaTableProps,
} from "react-aria-components";
import {
  Cell as AriaCell,
  Column as AriaColumn,
  Row as AriaRow,
  Table as AriaTable,
  TableBody as AriaTableBody,
  TableHeader as AriaTableHeader,
  useTableOptions,
} from "react-aria-components";

import { cn } from "@/lib/utils";

const TableContext = createContext<{ size: "sm" | "md" }>({ size: "md" });

const TableCardRoot = ({
  children,
  className,
  size = "md",
  ...props
}: HTMLAttributes<HTMLDivElement> & { size?: "sm" | "md" }) => {
  return (
    <TableContext.Provider value={{ size }}>
      <div
        data-slot="core-table-card"
        className={cn("overflow-hidden rounded-[var(--radius-card)] border border-border bg-card", className)}
        {...props}
      >
        {children}
      </div>
    </TableContext.Provider>
  );
};

interface TableCardHeaderProps {
  title: string;
  badge?: ReactNode;
  description?: string;
  contentTrailing?: ReactNode;
  className?: string;
}

const TableCardHeader = ({ title, badge, description, contentTrailing, className }: TableCardHeaderProps) => {
  const { size } = useContext(TableContext);

  return (
    <div
      className={cn(
        "relative border-b border-border",
        size === "sm" ? "px-4 py-3" : "px-5 py-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-compact font-semibold text-foreground">{title}</h3>
            {badge ? (
              isValidElement(badge) ? (
                badge
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
                  {badge}
                </span>
              )
            ) : null}
          </div>
          {description ? <p className="mt-1 text-caption text-muted-foreground">{description}</p> : null}
        </div>
        {contentTrailing}
      </div>
    </div>
  );
};

interface TableRootProps extends AriaTableProps, Omit<ComponentPropsWithRef<"table">, "className" | "slot" | "style"> {
  size?: "sm" | "md";
}

const TableRoot = ({ className, size = "md", ...props }: TableRootProps) => {
  const context = useContext(TableContext);

  return (
    <TableContext.Provider value={{ size: context?.size ?? size }}>
      <AriaTable
        className={(state) =>
          cn("w-full overflow-x-auto", typeof className === "function" ? className(state) : className)
        }
        {...props}
      />
    </TableContext.Provider>
  );
};
TableRoot.displayName = "Table";

interface TableHeaderProps extends Omit<AriaTableHeaderProps<object>, "children"> {
  bordered?: boolean;
  size?: "sm" | "md";
  children?: ReactNode;
}

const TableHeader = ({
  children,
  bordered = true,
  className,
  size: sizeProp,
  ...props
}: TableHeaderProps) => {
  const context = useContext(TableContext);
  const { selectionBehavior, selectionMode } = useTableOptions();
  const size = sizeProp ?? context.size;

  return (
    <AriaTableHeader
      {...props}
      className={(state) =>
        cn(
          "relative bg-muted/25",
          size === "sm" ? "h-9" : "h-11",
          bordered &&
            "[&>tr>th]:after:pointer-events-none [&>tr>th]:after:absolute [&>tr>th]:after:inset-x-0 [&>tr>th]:after:bottom-0 [&>tr>th]:after:h-px [&>tr>th]:after:bg-border",
          typeof className === "function" ? className(state) : className
        )
      }
    >
      {selectionBehavior === "toggle" && (
        <AriaColumn className="w-10 px-4">
          {selectionMode === "multiple" ? <span className="sr-only">Select all</span> : null}
        </AriaColumn>
      )}
      {children}
    </AriaTableHeader>
  );
};

TableHeader.displayName = "TableHeader";

interface TableHeadProps extends AriaColumnProps, Omit<ThHTMLAttributes<HTMLTableCellElement>, "children" | "className" | "style" | "id"> {
  label?: string;
}

const TableHead = ({ className, label, children, ...props }: TableHeadProps) => {
  const { selectionBehavior } = useTableOptions();

  return (
    <AriaColumn
      {...props}
      className={(state) =>
        cn(
          "relative p-0 px-4 py-2 text-left outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset md:px-5",
          selectionBehavior === "toggle" && "nth-2:pl-3",
          state.allowsSorting && "cursor-pointer select-none",
          typeof className === "function" ? className(state) : className
        )
      }
    >
      {(state) => (
        <div className="flex items-center gap-1">
          <span className="text-caption font-semibold text-muted-foreground">
            {label}
            {typeof children === "function" ? children(state) : children}
          </span>
          {state.allowsSorting ? (
            state.sortDirection ? (
              <ArrowDown
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground",
                  state.sortDirection === "ascending" && "rotate-180"
                )}
              />
            ) : (
              <ChevronSelectorVertical className="size-3.5 shrink-0 text-muted-foreground/60" />
            )
          ) : null}
        </div>
      )}
    </AriaColumn>
  );
};

TableHead.displayName = "TableHead";

interface TableRowProps<T extends object>
  extends Omit<AriaRowProps<T>, "children"> {
  highlightSelectedRow?: boolean;
  size?: "sm" | "md";
  children?: ReactNode;
}

const TableRow = <T extends object>({
  children,
  className,
  highlightSelectedRow = true,
  size: sizeProp,
  ...props
}: TableRowProps<T>) => {
  const context = useContext(TableContext);
  const { selectionBehavior } = useTableOptions();
  const size = sizeProp ?? context.size;

  return (
    <AriaRow
      {...props}
      className={(state) =>
        cn(
          "relative outline-none transition-colors after:pointer-events-none hover:bg-muted/20 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring/40",
          size === "sm" ? "min-h-14" : "min-h-[4.5rem]",
          highlightSelectedRow && "selected:bg-muted/30",
          "[&>td]:after:absolute [&>td]:after:inset-x-0 [&>td]:after:bottom-0 [&>td]:after:h-px [&>td]:after:w-full [&>td]:after:bg-border/70 last:[&>td]:after:hidden",
          typeof className === "function" ? className(state) : className
        )
      }
    >
      {selectionBehavior === "toggle" && <AriaCell className="w-10 px-4" />}
      {children}
    </AriaRow>
  );
};

TableRow.displayName = "TableRow";

interface TableCellProps extends AriaCellProps, Omit<TdHTMLAttributes<HTMLTableCellElement>, "children" | "className" | "style" | "id"> {
  ref?: Ref<HTMLTableCellElement>;
  size?: "sm" | "md";
}

const TableCell = ({ className, children, size: sizeProp, ...props }: TableCellProps) => {
  const context = useContext(TableContext);
  const { selectionBehavior } = useTableOptions();
  const size = sizeProp ?? context.size;

  return (
    <AriaCell
      {...props}
      className={(state) =>
        cn(
          "relative text-compact text-foreground outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring/40",
          size === "sm" && "px-4 py-3 md:px-5",
          size === "md" && "px-4 py-3.5 md:px-5 md:py-4",
          selectionBehavior === "toggle" && "nth-2:pl-3",
          typeof className === "function" ? className(state) : className
        )
      }
    >
      {children}
    </AriaCell>
  );
};

TableCell.displayName = "TableCell";

const TableCard = {
  Root: TableCardRoot,
  Header: TableCardHeader,
};

const Table = TableRoot as typeof TableRoot & {
  Body: typeof AriaTableBody;
  Cell: typeof TableCell;
  Head: typeof TableHead;
  Header: typeof TableHeader;
  Row: typeof TableRow;
};

Table.Body = AriaTableBody;
Table.Cell = TableCell;
Table.Head = TableHead;
Table.Header = TableHeader;
Table.Row = TableRow;

export { Table, TableCard };
