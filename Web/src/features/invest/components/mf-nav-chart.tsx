"use client";

type NavPoint = {
  date: string;
  nav: number | null;
};

export function MfNavChart({ points }: { points: NavPoint[] }) {
  const values = points.map((point) => point.nav).filter((value): value is number => value != null);
  if (values.length < 2) {
    return (
      <p className="text-compact text-muted-foreground">Not enough NAV data to display a chart.</p>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 640;
  const height = 160;
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card/50 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full text-primary" role="img" aria-label="NAV trend chart">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
