import { useEffect, useState } from "react";
import { X, Share, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIOS, isStandalone } from "@/pwa/registerSW";
import {
  getInstallPrompt,
  onInstallPromptChange,
  triggerInstall,
  type BIPEvent,
} from "@/pwa/installPrompt";
import { PwaIosInstructionsDialog } from "./PwaIosInstructionsDialog";

const DISMISS_KEY = "mcs.pwa.install.dismissed_at";
const DISMISS_DAYS = 14;

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = parseInt(raw, 10);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(getInstallPrompt());
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [iosDialogOpen, setIosDialogOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (recentlyDismissed()) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (!isMobile) return;

    const unsub = onInstallPromptChange((e) => {
      setDeferred(e);
      if (e) setVisible(true);
    });

    if (getInstallPrompt()) setVisible(true);

    if (isIOS()) {
      setIosHint(true);
      setVisible(true);
    }

    return () => {
      unsub();
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
    setVisible(false);
  };

  const install = async () => {
    const res = await triggerInstall();
    if (res === "accepted") {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* noop */
      }
    }
    setVisible(false);
  };

  return (
    <>
      <div
        className="fixed left-3 right-3 z-50 rounded-2xl border border-border bg-card shadow-lg md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        role="dialog"
        aria-label="Legg MCS på Hjem-skjermen"
      >
        <div className="flex items-start gap-3 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xs font-bold tracking-wide">
            MCS
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Legg MCS på Hjem-skjermen</p>
            {iosHint && !deferred ? (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Trykk <Share className="inline h-3.5 w-3.5 -mt-0.5" /> Del og
                <span className="font-medium"> «Legg til på Hjem-skjerm»</span>
                <Plus className="inline h-3.5 w-3.5 ml-0.5 -mt-0.5" />.
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Raskere tilgang, fullskjerm og varsler.
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {deferred && (
                <Button size="sm" className="h-8" onClick={install}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Installer
                </Button>
              )}
              {iosHint && !deferred && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => setIosDialogOpen(true)}>
                  Vis hvordan
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-8" onClick={dismiss}>
                Ikke nå
              </Button>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Lukk"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <PwaIosInstructionsDialog open={iosDialogOpen} onOpenChange={setIosDialogOpen} />
    </>
  );
}
