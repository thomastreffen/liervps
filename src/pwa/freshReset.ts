const APP_SW_PATHS = ["/sw.js", "/service-worker.js"];
const CLEANUP_MARKER_KEY = "lier_vps.runtime_cleanup_version";
const CLEANUP_RELOAD_MARKER_KEY = "lier_vps.runtime_cleanup_reloaded";

const CLEANUP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "lier-vps-runtime-clean-v2-dev";

function isAuthCallbackUrl(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.pathname.includes("auth/callback") ||
    window.location.pathname.includes("google-auth-callback") ||
    new URLSearchParams(window.location.search).has("code")
  );
}

function shouldRemoveStorageKey(key: string, includeSupabase: boolean): boolean {
  const normalized = key.toLowerCase();
  return (
    (includeSupabase && normalized.startsWith("sb-")) ||
    normalized.startsWith("mcs.") ||
    normalized.startsWith("msal.") ||
    normalized.startsWith("microsoft") ||
    normalized.startsWith("azure") ||
    normalized.includes("microsoftonline") ||
    normalized.includes("msal") ||
    normalized.includes("azure") ||
    normalized.startsWith("react-query")
  );
}

export function clearLegacyRuntimeStorage(options: { includeSupabase?: boolean; clearSession?: boolean } = {}) {
  const includeSupabase = options.includeSupabase ?? true;
  const clearSession = options.clearSession ?? true;

  try {
    Object.keys(localStorage).forEach((key) => {
      if (shouldRemoveStorageKey(key, includeSupabase)) localStorage.removeItem(key);
    });
  } catch {
    /* noop */
  }

  try {
    if (clearSession) sessionStorage.clear();
    else {
      Object.keys(sessionStorage).forEach((key) => {
        if (shouldRemoveStorageKey(key, includeSupabase)) sessionStorage.removeItem(key);
      });
    }
  } catch {
    /* noop */
  }
}

function cleanUrlWithoutResetParam(): string {
  const params = new URLSearchParams(window.location.search);
  params.delete("fresh");
  params.delete("sw");
  const search = params.toString();
  return window.location.pathname + (search ? `?${search}` : "") + window.location.hash;
}

function registrationScriptPath(registration: ServiceWorkerRegistration): string {
  const scriptURL =
    registration.active?.scriptURL ||
    registration.installing?.scriptURL ||
    registration.waiting?.scriptURL ||
    "";
  try {
    return new URL(scriptURL).pathname;
  } catch {
    return scriptURL;
  }
}

export async function getAppServiceWorkerRegistrations(): Promise<ServiceWorkerRegistration[]> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return [];
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.filter((registration) =>
      APP_SW_PATHS.some((path) => registrationScriptPath(registration).endsWith(path)),
    );
  } catch {
    return [];
  }
}

export async function unregisterAppServiceWorkers() {
  const registrations = await getAppServiceWorkerRegistrations();
  await Promise.allSettled(registrations.map((registration) => registration.unregister()));
}

export async function clearAppCachesAndUnregister() {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(registrations.map((registration) => registration.unregister()));
  }

  if (typeof caches !== "undefined") {
    const cacheNames = await caches.keys();
    await Promise.allSettled(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }
}

export async function runLierVpsRuntimeCleanup(): Promise<void> {
  if (typeof window === "undefined") return;

  let alreadyCleaned = false;
  try {
    alreadyCleaned = localStorage.getItem(CLEANUP_MARKER_KEY) === CLEANUP_VERSION;
  } catch {
    alreadyCleaned = false;
  }

  // Always unregister workers while PWA is disabled, even after the one-time
  // destructive cleanup has run.
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    } catch {
      /* noop */
    }
  }

  if (alreadyCleaned) return;

  const authCallback = isAuthCallbackUrl();
  if (typeof caches !== "undefined") {
    try {
      const cacheNames = await caches.keys();
      await Promise.allSettled(cacheNames.map((cacheName) => caches.delete(cacheName)));
    } catch {
      /* noop */
    }
  }

  clearLegacyRuntimeStorage({
    includeSupabase: !authCallback,
    clearSession: !authCallback,
  });

  try {
    localStorage.setItem(CLEANUP_MARKER_KEY, CLEANUP_VERSION);
  } catch {
    /* noop */
  }

  if (navigator.serviceWorker?.controller) {
    let hasReloaded = false;
    try {
      hasReloaded = localStorage.getItem(CLEANUP_RELOAD_MARKER_KEY) === CLEANUP_VERSION;
      localStorage.setItem(CLEANUP_RELOAD_MARKER_KEY, CLEANUP_VERSION);
    } catch {
      hasReloaded = true;
    }
    if (!hasReloaded) window.location.reload();
  }
}

export async function handleFreshResetIfRequested(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const resetRequested = params.get("fresh") === "1" || params.get("sw") === "off";
  if (!resetRequested) return false;

  await clearAppCachesAndUnregister();
  clearLegacyRuntimeStorage({ includeSupabase: true, clearSession: true });
  window.location.replace(cleanUrlWithoutResetParam());
  return true;
}