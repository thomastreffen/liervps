import { useEffect, useState } from "react";
import { Check, X as XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isStandalone } from "@/pwa/registerSW";
import { getInstallPrompt, onInstallPromptChange, detectPlatform } from "@/pwa/installPrompt";
import { EnableNotificationsButton } from "./EnableNotificationsButton";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Row({ label, value }: { label: string; value: string | boolean }) {
  const isBool = typeof value === "boolean";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      {isBool ? (
        value ? (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <Check className="h-4 w-4" /> Ja
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <XIcon className="h-4 w-4" /> Nei
          </span>
        )
      ) : (
        <span className="font-medium text-foreground">{value}</span>
      )}
    </div>
  );
}

export function PwaStatusDialog({ open, onOpenChange }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const unsub = onInstallPromptChange(() => setTick((t) => t + 1));
    return () => {
      unsub();
    };
  }, [open]);

  const standalone = isStandalone();
  const swActive =
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    !!navigator.serviceWorker.controller;
  const manifestFound =
    typeof document !== "undefined" && !!document.querySelector('link[rel="manifest"]');
  const pushSupported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  const permission =
    typeof Notification !== "undefined" ? Notification.permission : "ikke støttet";
  const bipAvailable = !!getInstallPrompt();
  const platform = detectPlatform();
  void tick;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>App-status</DialogTitle>
          <DialogDescription>Teknisk status for MCS som installerbar app.</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-card px-3">
          <Row label="Standalone" value={standalone} />
          <Row label="Service worker aktiv" value={swActive} />
          <Row label="Manifest funnet" value={manifestFound} />
          <Row label="Push støttet" value={pushSupported} />
          <Row label="Varseltillatelse" value={permission} />
          <Row label="Installprompt tilgjengelig" value={bipAvailable} />
          <Row label="Plattform" value={platform} />
        </div>

        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-sm font-medium">Varsler</p>
          <EnableNotificationsButton />
        </div>
      </DialogContent>
    </Dialog>
  );
}
