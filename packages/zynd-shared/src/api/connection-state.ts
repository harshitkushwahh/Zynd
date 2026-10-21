import { getApiUrl } from "./configure";
import { ApiError } from "./errors";

export type BackendConnectionState = {
  isWaiting: boolean;
  pendingCount: number;
};

type BackendConnectionListener = (state: BackendConnectionState) => void;

const listeners = new Set<BackendConnectionListener>();

/** Ignore a single wake/sleep blip; real API downtime still shows after this. */
export const BACKEND_WAITING_CONFIRM_MS = 3000;

/** Steady health check while the API is responding. */
export const BACKEND_HEALTH_OK_INTERVAL_MS = 30_000;

const BACKEND_DOWN_POLL_STEPS_MS = [15_000, 30_000, 60_000] as const;

/** Delay before the next probe after a confirmed outage. Grows, then holds. */
export function backendDownPollDelayMs(failureCount: number): number {
  const index = Math.min(
    Math.max(failureCount, 1) - 1,
    BACKEND_DOWN_POLL_STEPS_MS.length - 1,
  );
  return BACKEND_DOWN_POLL_STEPS_MS[index];
}

let pendingCount = 0;
let isWaiting = false;
let waitingConfirmTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  const state = getBackendConnectionState();
  for (const listener of listeners) {
    listener(state);
  }
}

export function getBackendConnectionState(): BackendConnectionState {
  return { isWaiting, pendingCount };
}

export function subscribeBackendConnectionState(
  listener: BackendConnectionListener
): () => void {
  listeners.add(listener);
  listener(getBackendConnectionState());
  return () => listeners.delete(listener);
}

export function beginBackendRequest(): void {
  pendingCount += 1;
  emit();
}

export function endBackendRequest(): void {
  pendingCount = Math.max(0, pendingCount - 1);
  emit();
}

function clearWaitingConfirmTimer(): void {
  if (waitingConfirmTimer === null) return;
  clearTimeout(waitingConfirmTimer);
  waitingConfirmTimer = null;
}

async function fetchBackendHealthOk(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiUrl()}/health`, { cache: "no-store" });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}

function scheduleWaiting(confirm: () => Promise<boolean>): void {
  if (isWaiting) return;
  if (waitingConfirmTimer !== null) return;
  waitingConfirmTimer = setTimeout(() => {
    waitingConfirmTimer = null;
    void (async () => {
      if (isWaiting) return;
      if (await confirm()) return;
      isWaiting = true;
      emit();
    })();
  }, BACKEND_WAITING_CONFIRM_MS);
}

/** A request failed. Confirm with one health check before showing downtime. */
export function markBackendConnectionWaiting(): void {
  scheduleWaiting(fetchBackendHealthOk);
}

/** Health already failed. Show downtime after the confirm delay, without another probe. */
export function markBackendConnectionDown(): void {
  scheduleWaiting(async () => false);
}

export function markBackendConnectionReady(): void {
  clearWaitingConfirmTimer();
  if (!isWaiting) return;
  isWaiting = false;
  emit();
}

export function isBackendConnectionStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

export function isBackendConnectionError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return (
      error.code === "network_error" ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504
    );
  }

  return error instanceof TypeError;
}
