import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Share2, Copy, ExternalLink, Loader2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import type { MaterialListRow } from "@/hooks/useMaterialList";

interface Props {
  list: MaterialListRow;
  onUpdateList: (patch: Partial<MaterialListRow>) => Promise<void>;
  onLog?: (event: string, message: string) => void;
}

export function MaterialSharePanel({ list, onUpdateList, onLog }: Props) {
  const [busy, setBusy] = useState(false);
  const shareUrl = list.share_token ? `${window.location.origin}/m/${list.share_token}` : null;

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const token = crypto.randomUUID();
      await onUpdateList({ share_token: token });
      onLog?.("share_enabled", "Materialliste delt med bestiller");
      toast.success("Delingslenke opprettet");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke opprette delingslenke");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (busy) return;
    if (!confirm("Deaktivere delingen? Eksisterende lenke vil slutte å virke.")) return;
    setBusy(true);
    try {
      await onUpdateList({ share_token: null });
      onLog?.("share_disabled", "Deling med bestiller deaktivert");
      toast.success("Deling deaktivert");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke deaktivere deling");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Lenke kopiert");
    } catch {
      toast.error("Kunne ikke kopiere");
    }
  };

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold">Deling med bestiller</h4>
            <p className="text-xs text-muted-foreground">
              {shareUrl
                ? "Bestiller kan se materialstatus og foreslå materiell via lenken under."
                : "Del materiallisten med bestiller via en sikker lenke."}
            </p>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              shareUrl
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {shareUrl ? "Delt" : "Ikke delt"}
          </span>
        </div>

        {shareUrl ? (
          <>
            <div className="flex items-center gap-2">
              <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input value={shareUrl} readOnly className="text-xs font-mono" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copy}>
                <Copy className="h-3.5 w-3.5" /> Kopier lenke
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.open(shareUrl, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" /> Åpne delt visning
              </Button>
              <Button size="sm" variant="ghost" onClick={disable} disabled={busy} className="ml-auto text-destructive">
                Deaktiver deling
              </Button>
            </div>
          </>
        ) : (
          <Button size="sm" onClick={enable} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
            Del materialliste med bestiller
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
