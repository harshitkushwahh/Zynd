import { ApiError } from "./errors";

export type BackendConnectionState = {
  isWaiting: boolean;
  pendingCount: number;
};

type BackendConnectionListener = (state: BackendConnectionState) => void;

const listeners = new Set<BackendConnectionListener>();

let pendingCount = 0;
let isWaiting = false;

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

export function markBackendConnectionWaiting(): void {
  if (isWaiting) return;
  isWaiting = true;
  emit();
}

export function markBackendConnectionReady(): void {
  if (!isWaiting) return;
  isWaiting = false;
  emit();
}

export function isBackendConnectionStatus(status: number): boolean {
  return status === 502 || status === 504;
}

export function isBackendConnectionError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === "network_error" || error.status === 502 || error.status === 504;
  }

  return error instanceof TypeError;
}
