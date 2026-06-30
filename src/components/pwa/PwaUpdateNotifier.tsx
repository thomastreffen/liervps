import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { onUpdateState, applyUpdateAndReload } from "@/pwa/registerSW";

// Heuristic: are we in the middle of typing/uploading?
// We treat composer focus + non-empty value, or contenteditable focus with
// content, or a file input recently in progress as "dirty".
function hasUnsavedWork(): boolean {
  if (typeof document === "undefined") return false;
  const ae = document.activeElement as HTMLElement | null;
  if (!ae) return false;
  const tag = ae.tagName;
  if (tag === "TEXTAREA") {
    return (ae as HTMLTextAreaElement).value.trim().length > 0;
  }
  if (tag === "INPUT") {
    const input = ae as HTMLInputElement;
    if (input.type === "text" || input.type === "search" || input.type === "email") {
      return input.value.trim().length > 0;
    }
  }
  if (ae.isContentEditable) {
    return (ae.textContent || "").trim().length > 0;
  }
  return false;
}

export function PwaUpdateNotifier() {
  const shown = useRef(false);
  const autoApplied = useRef(false);

  useEffect(() => {
    const off = onUpdateState(({ needRefresh }) => {
      if (!needRefresh || shown.current || autoApplied.current) return;

      // If the user is not typing/uploading, apply the update silently so the
      // tab is never stranded on a stale JS bundle (which is what causes
      // stale "Ny melding fra bestiller" badges that only clear in InPrivate).
      if (!hasUnsavedWork()) {
        autoApplied.current = true;
        toast.loading("Oppdaterer MCS til nyeste versjon…", {
          id: "pwa-update",
          duration: 4000,
        });
        void applyUpdateAndReload();
        return;
      }

      // Otherwise fall back to the explicit prompt so we don't drop typed text.
      shown.current = true;
      const doUpdate = () => {
        if (hasUnsavedWork()) {
          if (
            !window.confirm(
              "Du har usendte endringer. Vil du oppdatere likevel? Endringene kan gå tapt.",
            )
          ) {
            shown.current = false;
            return;
          }
        }
        toast.loading("Oppdaterer MCS…", { id: "pwa-update" });
        void applyUpdateAndReload();
      };

      toast(
        "Ny versjon av MCS er tilgjengelig",
        {
          id: "pwa-update",
          duration: Infinity,
          description: "Trykk Oppdater nå for å laste den nye versjonen.",
          action: { label: "Oppdater nå", onClick: doUpdate },
          cancel: {
            label: "Senere",
            onClick: () => {
              shown.current = false;
            },
          },
        },
      );
    });
    return off;
  }, []);

  return null;
}
