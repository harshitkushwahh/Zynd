export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function pollWithBackoff<T>(
  fn: () => Promise<T>,
  shouldContinue: (result: T) => boolean,
  options?: { maxAttempts?: number; baseDelayMs?: number },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 5;
  const baseDelayMs = options?.baseDelayMs ?? 500;
  let last: T | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    last = await fn();
    if (!shouldContinue(last)) {
      return last;
    }
    if (attempt < maxAttempts - 1) {
      await sleep(baseDelayMs * (attempt + 1));
    }
  }

  return last as T;
}
