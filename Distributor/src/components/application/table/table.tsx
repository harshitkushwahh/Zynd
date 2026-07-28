"use client";

import type {
  ComponentPropsWithRef,
  HTMLAttributes,
  ReactNode,
  Ref,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { createContext, isValidElement, useContext } from "react";
import { ArrowDown, ChevronsUpDown } from "lucide-react";
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

import { TableSelectionCheckbox } from "@/components/application/table/table-selection-checkbox";

import { cn } from "@/lib/utils";
import {
  DISTRIBUTOR_TABLE_CARD_HEADER_MD_CLASS,
  DISTRIBUTOR_TABLE_CARD_HEADER_SM_CLASS,
} from "@/lib/distributor-layout";

import { PaginationPageMinimalCenter, type TablePaginationProps } from "@/components/application/table/pagination";

const TableContext = createContext<{ size: "sm" | "md" }>({ size: "sm" });

const TableCardRoot = ({
  children,
  className,
  size = "sm",
  ...props
}: HTMLAttributes<HTMLDivElement> & { size?: "sm" | "md" }) => {
  return (
    <TableContext.Provider value={{ size }}>
      <div
        data-slot="distributor-table-card"
        className={cn(
          "max-w-full min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-border bg-card",
          className,
        )}
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

const TableCardHeader = ({
  title,
  badge,
  description,
  contentTrailing,
  className,
}: TableCardHeaderProps) => {
  const { size } = useContext(TableContext);

  return (
    <div
      className={cn(
        "relative border-b border-border",
        size === "sm" ? DISTRIBUTOR_TABLE_CARD_HEADER_SM_CLASS : DISTRIBUTOR_TABLE_CARD_HEADER_MD_CLASS,
        className,
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
          {description ? (
            <p className="mt-1 text-caption text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {contentTrailing}
      </div>
    </div>
  );
};

const TableCardContent = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("max-w-full overflow-x-auto overscroll-x-contain", className)}
    {...props}
  >
    {children}
  </div>
);

interface TableRootProps
  extends AriaTableProps,
    Omit<ComponentPropsWithRef<"table">, "className" | "slot" | "style"> {
  size?: "sm" | "md";
  pagination?: TablePaginationProps;
}

const TableRoot = ({
  className,
  size = "sm",
  pagination,
  selectionBehavior,
  selectionMode,
  ...props
}: TableRootProps) => {
  const context = useContext(TableContext);

  const resolvedSelectionBehavior =
    selectionBehavior ??
    (selectionMode != null && selectionMode !== "none" ? "toggle" : undefined);

  const table = (
    <TableContext.Provider value={{ size: context?.size ?? size }}>
      <AriaTable
        data-slot="distributor-table"
        selectionMode={selectionMode}
        selectionBehavior={resolvedSelectionBehavior}
        className={(state) =>
          cn("w-full", typeof className === "function" ? className(state) : className)
        }
        {...props}
      />
    </TableContext.Provider>
  );

  return (
    <>
      <TableCardContent>{table}</TableCardContent>
      {pagination &&
      (pagination.alwaysVisible || pagination.totalPages > 1) ? (
        <PaginationPageMinimalCenter
          page={Math.min(pagination.page, pagination.totalPages)}
          total={pagination.totalPages}
          onPageChange={pagination.onPageChange}
        />
      ) : null}
    </>
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
  const showSelectionColumn =
    selectionMode != null && selectionMode !== "none" && selectionBehavior === "toggle";

  return (
    <AriaTableHeader
      {...props}
      className={(state) =>
        cn(
          "relative bg-muted/25",
          size === "sm" ? "h-8" : "h-9",
          bordered &&
            "[&>tr>th]:after:pointer-events-none [&>tr>th]:after:absolute [&>tr>th]:after:inset-x-0 [&>tr>th]:after:bottom-0 [&>tr>th]:after:h-px [&>tr>th]:after:bg-border",
          typeof className === "function" ? className(state) : className,
        )
      }
    >
      {showSelectionColumn ? (
        <AriaColumn className="w-11 min-w-11 px-3">
          {selectionMode === "multiple" ? (
            <TableSelectionCheckbox aria-label="Select all" />
          ) : (
            <span className="sr-only">Select</span>
          )}
        </AriaColumn>
      ) : null}
      {children}
    </AriaTableHeader>
  );
};

TableHeader.displayName = "TableHeader";

interface TableHeadProps
  extends AriaColumnProps,
    Omit<
      ThHTMLAttributes<HTMLTableCellElement>,
      "children" | "className" | "style" | "id"
    > {
  label?: string;
}

const TableHead = ({ className, label, children, ...props }: TableHeadProps) => {
  const { selectionBehavior } = useTableOptions();

  return (
    <AriaColumn
      {...props}
      className={(state) =>
        cn(
          "relative p-0 px-3 py-1.5 text-left outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset md:px-4",
          selectionBehavior === "toggle" && "nth-2:pl-3",
          state.allowsSorting && "cursor-pointer select-none",
          typeof className === "function" ? className(state) : className,
        )
      }
    >
      {(state) => (
        <div className="flex items-center gap-0.5">
          <span className="text-tiny font-semibold text-muted-foreground">
            {label}
            {typeof children === "function" ? children(state) : children}
          </span>
          {state.allowsSorting ? (
            state.sortDirection ? (
              <ArrowDown
                className={cn(
                  "size-3 shrink-0 text-muted-foreground",
                  state.sortDirection === "ascending" && "rotate-180",
                )}
              />
            ) : (
              <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground/60" />
            )
          ) : null}
        </div>
      )}
    </AriaColumn>
  );
};

TableHead.displayName = "TableHead";

interface TableRowProps<T extends object> extends Omit<AriaRowProps<T>, "children"> {
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
  const { selectionBehavior, selectionMode } = useTableOptions();
  const size = sizeProp ?? context.size;
  const showSelectionColumn =
    selectionMode != null && selectionMode !== "none" && selectionBehavior === "toggle";

  return (
    <AriaRow
      {...props}
      className={(state) =>
        cn(
          "relative outline-none transition-colors after:pointer-events-none hover:bg-muted/20 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring/40",
          size === "sm" ? "min-h-9" : "min-h-10",
          highlightSelectedRow && "selected:bg-muted/30",
          "[&>td]:after:absolute [&>td]:after:inset-x-0 [&>td]:after:bottom-0 [&>td]:after:h-px [&>td]:after:w-full [&>td]:after:bg-border/70 last:[&>td]:after:hidden",
          typeof className === "function" ? className(state) : className,
        )
      }
    >
      {showSelectionColumn ? (
        <AriaCell className="w-11 min-w-11 px-3">
          <TableSelectionCheckbox aria-label="Select row" />
        </AriaCell>
      ) : null}
      {children}
    </AriaRow>
  );
};

TableRow.displayName = "TableRow";

interface TableCellProps
  extends AriaCellProps,
    Omit<TdHTMLAttributes<HTMLTableCellElement>, "children" | "className" | "style" | "id"> {
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
          "relative text-caption leading-snug text-foreground outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring/40",
          "[&_p]:text-caption [&_p]:leading-snug",
          size === "sm" && "px-3 py-1.5 md:px-4",
          size === "md" && "px-3 py-2 md:px-4",
          selectionBehavior === "toggle" && "nth-2:pl-3",
          typeof className === "function" ? className(state) : className,
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
  Content: TableCardContent,
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
