"use client";

import type {
  ComponentPropsWithRef,
  HTMLAttributes,
  ReactElement,
  ReactNode,
  ThHTMLAttributes,
} from "react";
import { Children, cloneElement, createContext, isValidElement, useContext, useState } from "react";
import { ArrowDown, ChevronsUpDown } from "lucide-react";
import type {
  ColumnProps as AriaColumnProps,
  RowProps as AriaRowProps,
  Selection,
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

import {
  DISTRIBUTOR_TABLE_CARD_HEADER_MD_CLASS,
  DISTRIBUTOR_TABLE_CARD_HEADER_SM_CLASS,
  DISTRIBUTOR_TABLE_CARD_SURFACE_CLASS,
} from "@/lib/distributor-layout";

import {
  DistributorTablePaginationFooter,
  shouldShowDistributorTablePagination,
  type TablePaginationProps,
} from "@/components/application/table/pagination";
import { cn } from "@/lib/utils";

const TableContext = createContext<{ size: "sm" | "md"; variant: "default" | "card-rows" }>({
  size: "sm",
  variant: "default",
});

function TableSelectionHeaderColumn({ selectionMode }: { selectionMode: "single" | "multiple" | undefined }) {
  return (
    <AriaColumn
      id="selection"
      aria-label="Select row"
      className="distributor-table__selection-head w-10 min-w-10 max-w-10 px-2"
    >
      {selectionMode === "multiple" ? (
        <TableSelectionCheckbox aria-label="Select all rows" />
      ) : (
        <span className="sr-only">Select</span>
      )}
    </AriaColumn>
  );
}

function TableSelectionBodyCell() {
  return (
    <AriaCell
      className="distributor-table__selection-cell w-10 min-w-10 max-w-10 px-2 py-[var(--distributor-table-row-padding-y)] align-middle"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <TableSelectionCheckbox aria-label="Select row" />
    </AriaCell>
  );
}

const TableCardRoot = ({
  children,
  className,
  size = "sm",
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "md";
  variant?: "default" | "card-rows";
}) => {
  return (
    <TableContext.Provider value={{ size, variant }}>
      <div
        data-slot="distributor-table-card"
        data-table-variant={variant === "card-rows" ? "card-rows" : undefined}
        className={cn(
          "max-w-full min-w-0 overflow-hidden border border-border bg-card",
          DISTRIBUTOR_TABLE_CARD_SURFACE_CLASS,
          variant === "card-rows" && "distributor-table-card--card-rows",
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
}: HTMLAttributes<HTMLDivElement>) => {
  const { variant } = useContext(TableContext);

  return (
    <div
      className={cn(
        "max-w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain",
        variant === "card-rows" && "distributor-table-card__content--card-rows distributor-table-card__scroll-x",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

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
  selectedKeys,
  onSelectionChange,
  children,
  ...props
}: TableRootProps) => {
  const context = useContext(TableContext);
  const isCardRows = context?.variant === "card-rows";
  const tableSize = context?.size ?? size;
  const [internalSelectedKeys, setInternalSelectedKeys] = useState<Selection>(() => new Set());

  const resolvedSelectionMode =
    selectionMode ?? (isCardRows ? "multiple" : undefined);

  const resolvedSelectionBehavior =
    selectionBehavior ??
    (resolvedSelectionMode === "single"
      ? "replace"
      : resolvedSelectionMode != null && resolvedSelectionMode !== "none"
        ? "toggle"
        : undefined);

  const showSelectionColumn =
    resolvedSelectionMode != null && resolvedSelectionMode !== "none";

  const resolvedSelectedKeys =
    selectedKeys ??
    (isCardRows && resolvedSelectionMode === "multiple" ? internalSelectedKeys : undefined);

  const resolvedOnSelectionChange =
    onSelectionChange ??
    (isCardRows && resolvedSelectionMode === "multiple" && selectedKeys === undefined
      ? setInternalSelectedKeys
      : onSelectionChange);

  const selectionHeaderColumn = showSelectionColumn ? (
    <TableSelectionHeaderColumn
      key="distributor-table-selection-column"
      selectionMode={resolvedSelectionMode === "multiple" ? "multiple" : "single"}
    />
  ) : null;

  const selectionBodyCell = showSelectionColumn ? (
    <TableSelectionBodyCell key="distributor-table-selection-cell" />
  ) : null;

  const prependSelectionToRow = <T extends object>(row: ReactNode): ReactNode => {
    if (!selectionBodyCell || !isValidElement(row) || row.type !== AriaRow) {
      return row;
    }

    const rowElement = row as ReactElement<AriaRowProps<T>>;
    const { children: rowChildren, ...rowProps } = rowElement.props;

    if (typeof rowChildren === "function") {
      return row;
    }

    return cloneElement(rowElement, rowProps, selectionBodyCell, ...Children.toArray(rowChildren));
  };

  const wrapTableBodyChildren = (bodyChildren: ReactNode): ReactNode => {
    if (!showSelectionColumn || bodyChildren == null) {
      return bodyChildren;
    }
    if (typeof bodyChildren === "function") {
      const renderRow = bodyChildren as (item: object) => ReactNode;
      const wrapped = (item: object) => prependSelectionToRow(renderRow(item));
      return wrapped as unknown as ReactNode;
    }
    return Children.map(bodyChildren, (child) => prependSelectionToRow(child));
  };

  const tableChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) {
      return child;
    }

    if (child.type === AriaTableHeader && selectionHeaderColumn) {
      const headerProps = child.props as TableHeaderProps;
      const { children: headerChildren, ...restHeaderProps } = headerProps;
      return cloneElement(
        child as ReactElement<TableHeaderProps>,
        restHeaderProps,
        selectionHeaderColumn,
        headerChildren,
      );
    }

    if (child.type === AriaTableBody && showSelectionColumn) {
      const bodyProps = child.props as { children?: ReactNode };
      return cloneElement(child as ReactElement<{ children?: ReactNode }>, {
        ...bodyProps,
        children: wrapTableBodyChildren(bodyProps.children),
      });
    }

    return child;
  });

  const table = (
    <TableContext.Provider value={{ size: tableSize, variant: context?.variant ?? "default" }}>
      <AriaTable
        data-slot="distributor-table"
        data-table-size={tableSize}
        data-table-variant={isCardRows ? "card-rows" : undefined}
        selectionMode={resolvedSelectionMode}
        selectionBehavior={resolvedSelectionBehavior}
        selectedKeys={resolvedSelectedKeys}
        onSelectionChange={resolvedOnSelectionChange}
        className={(state) =>
          cn(
            "distributor-table w-full",
            isCardRows && "distributor-table--card-rows",
            showSelectionColumn && "distributor-table--with-selection",
            typeof className === "function" ? className(state) : className,
          )
        }
        {...props}
      >
        {tableChildren}
      </AriaTable>
    </TableContext.Provider>
  );

  const paginationFooter =
    pagination && shouldShowDistributorTablePagination(pagination) ? (
      <DistributorTablePaginationFooter
        {...pagination}
        page={Math.min(pagination.page, pagination.totalPages)}
      />
    ) : null;

  if (!isCardRows) {
    return (
      <>
        <TableCardContent>{table}</TableCardContent>
        {paginationFooter}
      </>
    );
  }

  return (
    <div className="distributor-table-card__table-block">
      <TableCardContent>{table}</TableCardContent>
      {paginationFooter}
    </div>
  );
};
TableRoot.displayName = "Table";

interface TableHeaderProps extends Omit<AriaTableHeaderProps<object>, "children"> {
  bordered?: boolean;
  size?: "sm" | "md";
  children?: ReactNode;
}

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
          "distributor-table__head relative text-left outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
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

const TableCard = {
  Root: TableCardRoot,
  Header: TableCardHeader,
  Content: TableCardContent,
};

type TableHeaderComponent = typeof AriaTableHeader &
  ((props: TableHeaderProps) => ReturnType<typeof AriaTableHeader>);

const Table = TableRoot as typeof TableRoot & {
  Body: typeof AriaTableBody;
  Cell: typeof AriaCell;
  Head: typeof TableHead;
  Header: TableHeaderComponent;
  Row: typeof AriaRow;
};

Table.Body = AriaTableBody;
Table.Cell = AriaCell;
Table.Head = TableHead;
Table.Header = AriaTableHeader as TableHeaderComponent;
Table.Row = AriaRow;

export { Table, TableCard };
