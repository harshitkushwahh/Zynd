import type { SortDescriptor } from "react-aria-components";

function compareValues(
  first: unknown,
  second: unknown,
  direction: SortDescriptor["direction"],
): number {
  if (
    (typeof first === "number" && typeof second === "number") ||
    (typeof first === "boolean" && typeof second === "boolean")
  ) {
    const delta = Number(first) - Number(second);
    return direction === "descending" ? -delta : delta;
  }

  if (typeof first === "string" && typeof second === "string") {
    let cmp = first.localeCompare(second);
    if (direction === "descending") cmp *= -1;
    return cmp;
  }

  return 0;
}

/** Returns a new array sorted by a React Aria `SortDescriptor` (does not mutate input). */
export function sortByDescriptor<T extends object>(
  items: readonly T[],
  sortDescriptor: SortDescriptor,
): T[] {
  const column = sortDescriptor.column;
  if (!column) return [...items];

  return [...items].sort((a, b) => {
    const first = a[column as keyof T];
    const second = b[column as keyof T];
    return compareValues(first, second, sortDescriptor.direction);
  });
}
