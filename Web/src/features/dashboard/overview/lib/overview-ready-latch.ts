/** Persists overview ready state across Fast Refresh to avoid skeleton remount loops. */
let overviewReadyLatch = false;

export function readOverviewReadyLatch() {
  return overviewReadyLatch;
}

export function setOverviewReadyLatch(value: boolean) {
  overviewReadyLatch = value;
}

export function clearOverviewReadyLatch() {
  overviewReadyLatch = false;
}
