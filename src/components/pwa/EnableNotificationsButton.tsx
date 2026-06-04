import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getPushSupport, requestNotificationPermission, subscribeToPush } from "@/pwa/push";

export function EnableNotificationsButton() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | "ios-not-installed">(
    "default",
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const support = getPushSupport();
    if (!support.supported) {
      setPermission(support.reason === "ios-not-installed" ? "ios-not-installed" : "unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  if (permission === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">Varsler støttes ikke i denne nettleseren.</p>
    );
  }

  if (permission === "ios-not-installed") {
    return (
      <p className="text-sm text-muted-foreground">
        Legg MCS til på Hjem-skjerm først for å kunne aktivere varsler på iPhone/iPad.
      </p>
    );
  }

  if (permission === "granted") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Bell className="h-4 w-4 text-primary" />
        Varsler er aktivert
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BellOff className="h-4 w-4" />
        Varsler er blokkert. Skru på i nettleserinnstillingene for å aktivere.
      </div>
    );
  }

  const enable = async () => {
    setLoading(true);
    try {
      const res = await requestNotificationPermission();
      setPermission(res);
      if (res === "granted") {
        await subscribeToPush();
        toast.success("Varsler aktivert");
      } else if (res === "denied") {
        toast.error("Varsler ble avslått");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={enable} disabled={loading} variant="outline" size="sm">
      <Bell className="mr-2 h-4 w-4" />
      Aktiver varsler
    </Button>
  );
}
