const APP_SW_PATHS = ["/sw.js", "/service-worker.js"];

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

export async function handleFreshResetIfRequested(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const resetRequested = params.get("fresh") === "1" || params.get("sw") === "off";
  if (!resetRequested) return false;

  await clearAppCachesAndUnregister();
  window.location.replace(cleanUrlWithoutResetParam());
  return true;
}