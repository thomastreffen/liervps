// Push notification scaffolding. Does NOT send notifications; only sets up subscription.
import { supabase } from "@/integrations/supabase/client";

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: "no-sw" | "no-push" | "no-notification" | "ios-not-installed" };

type PushReason = "no-sw" | "no-push" | "no-notification" | "ios-not-installed";

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, reason: "no-sw" };
  if (!("serviceWorker" in navigator)) return { supported: false, reason: "no-sw" };
  if (!("PushManager" in window)) {
    // iOS only supports web push when installed to home screen
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua);
    const w = window as Window & { navigator: Navigator & { standalone?: boolean } };
    const standalone =
      w.matchMedia?.("(display-mode: standalone)").matches ||
      w.navigator.standalone === true;
    if (ios && !standalone) return { supported: false, reason: "ios-not-installed" };
    return { supported: false, reason: "no-push" };
  }
  if (!("Notification" in window)) return { supported: false, reason: "no-notification" };
  return { supported: true };
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.requestPermission();
}

/**
 * Subscribe to push and persist subscription server-side.
 * VAPID public key must be configured via VITE_VAPID_PUBLIC_KEY when backend push is built.
 * Until then, this stores the raw subscription if a `push_subscriptions` table exists; otherwise no-op.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const support = getPushSupport();
  if (!support.supported) return null;
  const reg = await navigator.serviceWorker.ready;
  const vapid = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? "";
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    if (!vapid) {
      // Without VAPID key we cannot create a useful subscription. Caller should treat as "not ready".
      return null;
    }
    sub = await reg.pushManager.subscribe({
      userInvisible: false as never,
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    } as PushSubscriptionOptionsInit);
  }
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      // Best-effort persist; ignore if table doesn't exist yet.
      await (supabase as unknown as { from: (t: string) => { upsert: (v: unknown, o: unknown) => Promise<unknown> } })
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userData.user.id,
            endpoint: sub.endpoint,
            subscription: sub.toJSON(),
            user_agent: navigator.userAgent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" },
        )
        .catch?.(() => undefined);
    }
  } catch {
    /* table may not exist yet; safe to ignore */
  }
  return sub;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}
