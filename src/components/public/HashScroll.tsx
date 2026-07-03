import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to element matching location.hash on route/hash changes.
 * Handles anchor navigation for public homepage sections.
 */
export function HashScroll() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace("#", "");
    // Wait a frame so the target section is mounted.
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [pathname, hash]);

  return null;
}
