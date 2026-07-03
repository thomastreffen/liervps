// Lier VPS: PWA/service-worker registration is temporarily disabled.
// This module only exposes compatibility helpers and actively removes any old
// Workbox/service-worker registrations that may still control a tab.

import {
  getAppServiceWorkerRegistrations,
  handleFreshResetIfRequested,
  unregisterAppServiceWorkers,
} from "./freshReset";
export { clearAppCachesAndUnregister } from "./freshReset";

type UpdateListener = (state: { needRefresh: boolean; offlineReady: boolean }) => void;
let needRefresh = false;
let offlineReady = false;
const updateListeners = new Set<UpdateListener>();
let currentRegistration: ServiceWorkerRegistration | undefined;

function emit() {
  const state = { needRefresh, offlineReady };
  updateListeners.forEach((l) => {
    try {
      l(state);
    } catch {
      /* noop */
    }
  });
}

export function onUpdateState(l: UpdateListener): () => void {
  updateListeners.add(l);
  // Replay current state.
  l({ needRefresh, offlineReady });
  return () => {
    updateListeners.delete(l);
  };
}

export function getUpdateState() {
  return { needRefresh, offlineReady };
}

async function handleFreshQuery(): Promise<boolean> {
  return handleFreshResetIfRequested();
}

export function cleanupLegacyServiceWorkers() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // ?fresh=1 — emergency reset, then reload clean. Otherwise never register a
  // new worker while Lier VPS is stabilising; only unregister old workers.
  void handleFreshQuery().then((handled) => {
    if (handled) return;
    void unregisterAppServiceWorkers();
  });
}

export async function checkForUpdate(): Promise<boolean> {
  if (!currentRegistration) {
    const regs = await getAppServiceWorkerRegistrations();
    currentRegistration = regs[0];
  }
  if (!currentRegistration) return false;
  try {
    await currentRegistration.update();
    return true;
  } catch {
    return false;
  }
}

export async function applyUpdateAndReload() {
  window.location.reload();
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mq || iosStandalone);
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}
