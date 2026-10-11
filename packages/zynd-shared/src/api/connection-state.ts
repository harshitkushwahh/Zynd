import { ApiError } from "./errors";

export type BackendConnectionState = {
  isWaiting: boolean;
  pendingCount: number;
};

type BackendConnectionListener = (state: BackendConnectionState) => void;

const listeners = new Set<BackendConnectionListener>();

/** Ignore a single wake/sleep blip; real API downtime still shows after this. */
export const BACKEND_WAITING_CONFIRM_MS = 3000;

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

export function markBackendConnectionWaiting(): void {
  if (isWaiting) return;
  if (waitingConfirmTimer !== null) return;
  waitingConfirmTimer = setTimeout(() => {
    waitingConfirmTimer = null;
    if (isWaiting) return;
    isWaiting = true;
    emit();
  }, BACKEND_WAITING_CONFIRM_MS);
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
