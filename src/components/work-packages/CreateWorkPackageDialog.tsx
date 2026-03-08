import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WP_TYPE_CONFIG, ALL_WP_TYPES, type WorkPackageType } from "@/lib/work-package-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onCreated: () => void;
}

export function CreateWorkPackageDialog({ open, onOpenChange, projectId, onCreated }: Props) {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [wpType, setWpType] = useState<WorkPackageType>("internal_task");
  const [customerVisible, setCustomerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !user) return;
    setSaving(true);

    try {
      // Get parent project's details for defaults
      const { data: parent } = await supabase
        .from("events")
        .select("customer, address, company_id, start_time, end_time")
        .eq("id", projectId)
        .single();

      const now = new Date();
      const defaultEnd = new Date(now.getTime() + 60 * 60 * 1000);

      const { error } = await supabase.from("events").insert({
        title: title.trim(),
        description: description.trim() || null,
        parent_project_id: projectId,
        work_package_type: wpType,
        customer_visible: customerVisible,
        project_type: "work_package",
        status: "requested",
        documentation_status: "pending",
        customer: parent?.customer || "",
        address: parent?.address || "",
        company_id: parent?.company_id || activeCompanyId,
        start_time: parent?.start_time || now.toISOString(),
        end_time: parent?.end_time || defaultEnd.toISOString(),
        created_by: user.id,
      } as any);

      if (error) throw error;

      toast.success("Arbeidspakke opprettet ✓");
      setTitle("");
      setDescription("");
      setWpType("internal_task");
      setCustomerVisible(false);
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error("Kunne ikke opprette arbeidspakke", {
        description: err?.message || "Sjekk nettverksforbindelsen og prøv igjen",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ny arbeidspakke</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type selector */}
          <div className="space-y-2">
            <Label className="text-xs">Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_WP_TYPES.map((t) => {
                const cfg = WP_TYPE_CONFIG[t];
                const Icon = cfg.icon;
                const selected = wpType === t;
                return (
                  <button
                    key={t}
                    onClick={() => setWpType(t)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-3 text-left transition-all",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border/40 hover:border-border/70"
                    )}
                  >
                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", cfg.bgColor)}>
                      <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium block">{cfg.label}</span>
                      <span className="text-[10px] text-muted-foreground block leading-tight">{cfg.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tittel</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kort beskrivelse av arbeidspakken"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Beskrivelse (valgfritt)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detaljer om hva som skal gjøres"
              rows={3}
              className="text-sm"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
            <div>
              <p className="text-xs font-medium">Synlig for kunde</p>
              <p className="text-[10px] text-muted-foreground">Kunden ser arbeidspakken når den er ferdig dokumentert</p>
            </div>
            <Switch checked={customerVisible} onCheckedChange={setCustomerVisible} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Opprett arbeidspakke
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
