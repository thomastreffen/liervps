import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Package, CheckCircle2, Truck, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { MaterialListRow } from "@/hooks/useMaterialList";

interface Props {
  list: MaterialListRow;
  onUpdateList: (patch: Partial<MaterialListRow>) => Promise<void>;
  onLog?: (event: string, message: string, metadata?: Record<string, unknown>) => void;
}

export function MaterialPickPanel({ list, onUpdateList, onLog }: Props) {
  const [crate, setCrate] = useState(list.crate_location ?? "");
  const [comment, setComment] = useState(list.picked_comment ?? "");
  const [savingCrate, setSavingCrate] = useState(false);

  const confirmPicked = async () => {
    const { data: userRes } = await import("@/integrations/supabase/client").then((m) => m.supabase.auth.getUser());
    await onUpdateList({
      picked_at: new Date().toISOString(),
      picked_by: userRes.user?.id ?? null,
      crate_location: crate || null,
      picked_comment: comment || null,
      status: "plukket",
    });
    toast.success("Plukket til kasse bekreftet");
    onLog?.("picked_confirmed", `Plukket til kasse${crate ? ` (kasse: ${crate})` : ""}`);
  };

  const confirmDispatched = async () => {
    const { data: userRes } = await import("@/integrations/supabase/client").then((m) => m.supabase.auth.getUser());
    await onUpdateList({
      dispatched_at: new Date().toISOString(),
      dispatched_by: userRes.user?.id ?? null,
      status: "med_montor",
    });
    toast.success("Sendt med montør bekreftet");
    onLog?.("dispatched", "Sendt med montør");
  };

  const confirmDelivered = async () => {
    const { data: userRes } = await import("@/integrations/supabase/client").then((m) => m.supabase.auth.getUser());
    await onUpdateList({
      delivered_to_job_at: new Date().toISOString(),
      delivered_to_job_by: userRes.user?.id ?? null,
      status: "levert_jobb",
    });
    toast.success("Levert på jobb bekreftet");
    onLog?.("delivered", "Levert på jobb");
  };

  const saveCrate = async () => {
    setSavingCrate(true);
    try {
      await onUpdateList({ crate_location: crate || null, picked_comment: comment || null });
      toast.success("Lagret");
    } finally {
      setSavingCrate(false);
    }
  };

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-3">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Plukk og levering
          </h4>
          <p className="text-xs text-muted-foreground">
            Bekreft når materiell er plukket til kasse, sendt med montør og levert på jobb.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Kasse / hylleplass
            </Label>
            <Input
              value={crate}
              placeholder="F.eks. Kasse 12, Hylle A3"
              onChange={(e) => setCrate(e.target.value)}
              onBlur={saveCrate}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Plukk-kommentar</Label>
            <Textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={saveCrate}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <StatusStep
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Plukket til kasse"
            value={list.picked_at}
            buttonLabel="Bekreft plukket"
            onConfirm={confirmPicked}
            disabled={savingCrate}
          />
          <StatusStep
            icon={<Truck className="h-4 w-4" />}
            label="Med montør"
            value={list.dispatched_at}
            buttonLabel="Bekreft med montør"
            onConfirm={confirmDispatched}
            disabled={!list.picked_at}
            disabledHint="Bekreft plukket først"
          />
          <StatusStep
            icon={<MapPin className="h-4 w-4" />}
            label="Levert på jobb"
            value={list.delivered_to_job_at}
            buttonLabel="Bekreft levert"
            onConfirm={confirmDelivered}
            disabled={!list.dispatched_at}
            disabledHint="Bekreft med montør først"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusStep({
  icon,
  label,
  value,
  buttonLabel,
  onConfirm,
  disabled,
  disabledHint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  buttonLabel: string;
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon} {label}
      </div>
      {value ? (
        <div className="text-xs text-emerald-700 dark:text-emerald-400">
          {new Date(value).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Ikke bekreftet</div>
      )}
      <Button
        size="sm"
        variant={value ? "outline" : "default"}
        onClick={onConfirm}
        disabled={disabled}
        title={disabled ? disabledHint : undefined}
        className="w-full"
      >
        {value ? "Bekreft på nytt" : buttonLabel}
      </Button>
    </div>
  );
}
