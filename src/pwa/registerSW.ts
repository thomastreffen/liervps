// Guarded service worker registration via vite-plugin-pwa's virtual module.
// Provides:
//   - safe refusal in dev / Lovable preview / iframes / ?sw=off
//   - ?fresh=1 hard-reset (unregister SW + delete caches + reload clean)
//   - update-available pub/sub for the UpdateNotifier UI
//   - manual "check for update" and "clear all caches" helpers
//   - one-shot stale-chunk reload (handled in chunkErrorRecovery)

import { registerSW as viteRegisterSW } from "virtual:pwa-register";

const APP_SW_PATHS = ["/sw.js", "/service-worker.js"];

type UpdateListener = (state: { needRefresh: boolean; offlineReady: boolean }) => void;
let needRefresh = false;
let offlineReady = false;
const updateListeners = new Set<UpdateListener>();
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
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

function shouldRefuse(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  ) {
    return true;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("sw") === "off") return true;
  return false;
}

async function getAppRegistrations(): Promise<ServiceWorkerRegistration[]> {
  if (!("serviceWorker" in navigator)) return [];
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.filter((r) => {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      return APP_SW_PATHS.some((p) => url.endsWith(p));
    });
  } catch {
    return [];
  }
}

async function unregisterAppSW() {
  const regs = await getAppRegistrations();
  await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
}

async function deleteAppCaches() {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    // workbox/vite-plugin-pwa cache buckets for this scope
    const targets = names.filter(
      (n) =>
        /precache-v\d+/.test(n) ||
        /-runtime/.test(n) ||
        n.startsWith("html-navigations") ||
        n.startsWith("static-assets") ||
        n.startsWith("workbox-"),
    );
    await Promise.all(targets.map((n) => caches.delete(n).catch(() => false)));
  } catch {
    /* noop */
  }
}

export async function clearAppCachesAndUnregister() {
  await unregisterAppSW();
  await deleteAppCaches();
}

async function handleFreshQuery(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  if (params.get("fresh") !== "1") return false;
  await clearAppCachesAndUnregister();
  params.delete("fresh");
  const search = params.toString();
  const newUrl =
    window.location.pathname + (search ? `?${search}` : "") + window.location.hash;
  window.location.replace(newUrl);
  return true;
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // ?fresh=1 — emergency reset, then reload clean.
  void handleFreshQuery().then((handled) => {
    if (handled) return;

    if (shouldRefuse()) {
      void unregisterAppSW();
      return;
    }

    try {
      updateSW = viteRegisterSW({
        immediate: true,
        onNeedRefresh() {
          needRefresh = true;
          emit();
          // eslint-disable-next-line no-console
          console.info("[pwa] update available");
        },
        onOfflineReady() {
          offlineReady = true;
          emit();
        },
        onRegisteredSW(_swUrl, registration) {
          currentRegistration = registration;
          // Periodic update check every 30 minutes while the tab is open.
          if (registration) {
            setInterval(
              () => {
                registration.update().catch(() => undefined);
              },
              30 * 60 * 1000,
            );
          }
        },
        onRegisterError(err) {
          // eslint-disable-next-line no-console
          console.warn("[pwa] register error", err);
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[pwa] register failed", err);
    }
  });
}

export async function checkForUpdate(): Promise<boolean> {
  if (!currentRegistration) {
    const regs = await getAppRegistrations();
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
  if (updateSW) {
    try {
      await updateSW(true);
      return;
    } catch {
      /* fall through */
    }
  }
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
