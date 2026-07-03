const MICROSOFT_LOGOUT_RE = /microsoftonline\.com|logoutsession|msal|azure/i;

function blockedTarget(url: unknown): boolean {
  if (!url) return false;
  try {
    return MICROSOFT_LOGOUT_RE.test(String(url));
  } catch {
    return false;
  }
}

function redirectToLocalLogin() {
  try {
    window.location.replace("/login");
  } catch {
    window.location.href = "/login";
  }
}

export function installNavigationGuard() {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { __lierVpsNavigationGuardInstalled?: boolean };
  if (w.__lierVpsNavigationGuardInstalled) return;
  w.__lierVpsNavigationGuardInstalled = true;

  const originalOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (blockedTarget(url)) {
      console.warn("[NavigationGuard] Blocked Microsoft/Azure navigation", { url: String(url) });
      redirectToLocalLogin();
      return null;
    }
    return originalOpen(url as any, target, features);
  }) as typeof window.open;

  try {
    const proto = Location.prototype as any;
    const originalAssign = proto.assign;
    const originalReplace = proto.replace;
    if (typeof originalAssign === "function") {
      proto.assign = function assignGuarded(url: string | URL) {
        if (blockedTarget(url)) {
          console.warn("[NavigationGuard] Blocked Microsoft/Azure location.assign", { url: String(url) });
          return originalReplace.call(this, "/login");
        }
        return originalAssign.call(this, url);
      };
    }
    if (typeof originalReplace === "function") {
      proto.replace = function replaceGuarded(url: string | URL) {
        if (blockedTarget(url)) {
          console.warn("[NavigationGuard] Blocked Microsoft/Azure location.replace", { url: String(url) });
          return originalReplace.call(this, "/login");
        }
        return originalReplace.call(this, url);
      };
    }
  } catch {
    // Some browsers lock down Location.prototype; signOut still uses /login only.
  }

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || !blockedTarget(anchor.href)) return;
      event.preventDefault();
      event.stopPropagation();
      console.warn("[NavigationGuard] Blocked Microsoft/Azure link click", { url: anchor.href });
      redirectToLocalLogin();
    },
    true,
  );
}