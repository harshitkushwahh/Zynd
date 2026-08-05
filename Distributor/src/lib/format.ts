const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatDistributorDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatDistributorDateTime(iso: string): string {
  const formatted = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
  return formatted.replace(/\s?(AM|PM)$/i, (match) => ` ${match.trim().toLowerCase()}`);
}

const INR_CRORE = 1_00_00_000;
const INR_LAKH = 1_00_000;

function formatScaledPortfolioInrCrore(amount: number): string {
  const scaled = amount / INR_CRORE;
  const body = Math.abs(scaled).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = amount < 0 ? "-" : "";
  return `${prefix}₹${body} Cr`;
}

function formatScaledPortfolioInrLakh(amount: number): string {
  const scaled = amount / INR_LAKH;
  const body = Math.abs(scaled).toLocaleString("en-IN", {
    minimumFractionDigits: scaled >= 100 ? 0 : 2,
    maximumFractionDigits: scaled >= 100 ? 0 : 2,
  });
  const prefix = amount < 0 ? "-" : "";
  return `${prefix}₹${body} L`;
}

function formatCompactInr(amount: number): string {
  return currencyFormatter.format(amount).replace(/\.00$/, "");
}

/**
 * Portfolio metric tiles: always ≤2 decimal places; uses L/Cr labels so large
 * values (100 Cr–1,000 Cr+) fit narrow cards. Use `formatAum` for full INR in tooltips.
 */
export function formatPortfolioMetricAmount(amount: number | null): string {
  if (amount === null) return "—";
  const abs = Math.abs(amount);
  if (abs >= INR_CRORE) {
    return formatScaledPortfolioInrCrore(amount);
  }
  if (abs >= INR_LAKH) {
    return formatScaledPortfolioInrLakh(amount);
  }
  return formatCompactInr(amount);
}

export function formatAum(amount: number | null): string {
  if (amount === null) return "—";
  return currencyFormatter.format(amount);
}

export function formatDistributorUnits(units: number): string {
  return units.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}

export function formatDistributorNav(nav: number): string {
  return nav.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
