const DEFAULT_REFRESH_SPIN_MIN_MS = 500;

export async function refreshWithMinimumDuration(
  refresh: () => Promise<void>,
  minimumMs = DEFAULT_REFRESH_SPIN_MIN_MS,
): Promise<void> {
  await Promise.all([
    refresh(),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, minimumMs);
    }),
  ]);
}
