const DETAIL_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const DETAIL_WITH_SECONDS_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DETAIL_OPTIONS,
  second: "2-digit",
};

export function formatTimestamp(value?: string | null, fallback = "No data") {
  return value ? new Date(value).toLocaleString() : fallback;
}

export function formatTimestampDetail(value: string, includeSeconds = false) {
  return new Date(value).toLocaleString(
    undefined,
    includeSeconds ? DETAIL_WITH_SECONDS_OPTIONS : DETAIL_OPTIONS,
  );
}
