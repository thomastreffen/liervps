import { useEffect, useState } from "react";
import { Download, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getInstallPrompt,
  onInstallPromptChange,
  triggerInstall,
  detectPlatform,
} from "@/pwa/installPrompt";
import { isStandalone } from "@/pwa/registerSW";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallAppDialog({ open, onOpenChange }: Props) {
  const [hasPrompt, setHasPrompt] = useState(!!getInstallPrompt());

  useEffect(() => {
    const unsub = onInstallPromptChange((e) => setHasPrompt(!!e));
    return () => {
      unsub();
    };
  }, []);

  const platform = detectPlatform();
  const standalone = isStandalone();

  const install = async () => {
    const res = await triggerInstall();
    if (res === "accepted") onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Installer MCS</DialogTitle>
          <DialogDescription>
            {standalone
              ? "MCS er allerede installert og kjører som app."
              : "Få MCS som ikon på enheten din."}
          </DialogDescription>
        </DialogHeader>

        {standalone ? (
          <p className="text-sm text-muted-foreground">Du bruker MCS som installert app nå.</p>
        ) : platform === "ios" ? (
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                1
              </span>
              <span>
                Trykk <Share className="inline h-4 w-4 -mt-0.5" /> Del-knappen i Safari.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                2
              </span>
              <span>
                Velg <span className="font-medium">«Legg til på Hjem-skjerm»</span>{" "}
                <Plus className="inline h-4 w-4 -mt-0.5" />.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                3
              </span>
              <span>Bekreft «Legg til». MCS dukker opp på Hjem-skjermen som app.</span>
            </li>
          </ol>
        ) : hasPrompt ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Klikk under for å installere MCS som en egen app.
            </p>
            <Button onClick={install} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Installer MCS
            </Button>
          </div>
        ) : platform === "android" ? (
          <p className="text-sm text-muted-foreground">
            Åpne Chrome-menyen (⋮) og velg <span className="font-medium">«Legg til på startskjerm»</span>{" "}
            eller <span className="font-medium">«Installer app»</span>.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Se etter installeringsikonet til høyre i adressefeltet i Chrome eller Edge. Hvis det ikke
            vises, er appen allerede installert eller nettleseren støtter det ikke.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
