import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WP_TYPE_CONFIG, type WorkPackageType } from "@/lib/work-package-types";
import type { TaskMessage } from "@/hooks/useTaskThread";
import type { ActionType } from "./MessageActionMenu";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: ActionType | null;
  sourceMessage: TaskMessage | null;
  taskId: string;
  companyId: string;
  onCreated: (actionType: ActionType, title: string, createdId: string) => void;
}

const ACTION_LABELS: Record<ActionType, string> = {
  deviation: "Nytt avvik",
  additional_work: "Nytt tillegg",
  internal_task: "Ny oppgave",
  offer: "Nytt tilbud",
};

export function CreateActionFromMessageSheet({
  open, onOpenChange, actionType, sourceMessage, taskId, companyId, onCreated,
}: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerVisible, setCustomerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-fill from source message
  useEffect(() => {
    if (!sourceMessage || !open) return;
    const body = sourceMessage.body || "";
    // Use first line as title, rest as description
    const lines = body.split("\n").filter(l => l.trim());
    setTitle(lines[0]?.slice(0, 120) || "");
    setDescription(lines.slice(1).join("\n").slice(0, 500) || "");
    setCustomerVisible(actionType === "deviation" || actionType === "additional_work");
  }, [sourceMessage, open, actionType]);

  const handleSave = async () => {
    if (!title.trim() || !user || !actionType) return;
    setSaving(true);

    try {
      if (actionType === "offer") {
        // Create a calculation/offer
        const { data, error } = await supabase.from("calculations").insert({
          project_title: title.trim(),
          description: description.trim() || null,
          customer_name: "",
          created_by: user.id,
          company_id: companyId,
          status: "draft",
        } as any).select("id").single();
        if (error) throw error;
        onCreated(actionType, title.trim(), (data as any).id);
      } else {
        // Create work package (event)
        const wpType: WorkPackageType = actionType as WorkPackageType;

        // Get parent task's details
        const { data: parent } = await supabase
          .from("events")
          .select("customer, address, company_id, start_time, end_time, parent_project_id")
          .eq("id", taskId)
          .single();

        const parentProjectId = (parent as any)?.parent_project_id || taskId;
        const now = new Date();
        const defaultEnd = new Date(now.getTime() + 60 * 60 * 1000);

        const { data, error } = await supabase.from("events").insert({
          title: title.trim(),
          description: description.trim() || null,
          parent_project_id: parentProjectId,
          work_package_type: wpType,
          customer_visible: customerVisible,
          project_type: "work_package",
          status: "requested",
          documentation_status: "pending",
          customer: (parent as any)?.customer || "",
          address: (parent as any)?.address || "",
          company_id: (parent as any)?.company_id || companyId,
          start_time: (parent as any)?.start_time || now.toISOString(),
          end_time: (parent as any)?.end_time || defaultEnd.toISOString(),
          created_by: user.id,
        } as any).select("id").single();

        if (error) throw error;
        onCreated(actionType, title.trim(), (data as any).id);
      }

      toast.success(`${ACTION_LABELS[actionType] || "Handling"} opprettet ✓`);
      setTitle("");
      setDescription("");
      setCustomerVisible(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Kunne ikke opprette", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  if (!actionType) return null;

  const isWorkPackage = actionType !== "offer";
  const wpConfig = isWorkPackage ? WP_TYPE_CONFIG[actionType as WorkPackageType] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md w-full flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {wpConfig && (() => {
              const Icon = wpConfig.icon;
              return <Icon className={cn("h-4 w-4", wpConfig.color)} />;
            })()}
            {ACTION_LABELS[actionType]}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4 flex-1">
          {/* Source message preview */}
          {sourceMessage && (
            <div className="rounded-md border-l-2 border-primary/30 bg-muted/50 px-3 py-2">
              <p className="text-[10px] text-muted-foreground mb-0.5">Opprettet fra melding av {sourceMessage.author_name || "Ukjent"}</p>
              <p className="text-xs text-foreground/80 line-clamp-2">{sourceMessage.body?.slice(0, 200)}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Tittel</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kort beskrivelse"
              className="text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Beskrivelse</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detaljer"
              rows={4}
              className="text-sm"
            />
          </div>

          {isWorkPackage && (
            <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
              <div>
                <p className="text-xs font-medium">Synlig for kunde</p>
                <p className="text-[10px] text-muted-foreground">Kunden ser dette når det er dokumentert</p>
              </div>
              <Switch checked={customerVisible} onCheckedChange={setCustomerVisible} />
            </div>
          )}
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Opprett
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
