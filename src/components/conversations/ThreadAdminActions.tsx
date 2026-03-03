import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Lock, Unlock, Gavel, AlertTriangle, Repeat, MessageSquare,
  Link2, FileDown, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ThreadAdminActionsProps {
  thread: any;
  isAdmin: boolean;
  onUpdate: (patch: Record<string, any>) => void;
}

export function ThreadAdminActions({ thread, isAdmin, onUpdate }: ThreadAdminActionsProps) {
  const { user } = useAuth();
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionSummary, setDecisionSummary] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isAdmin) return null;

  const isClosed = thread.status === "closed";
  const category = thread.thread_category || "normal";

  const updateThread = async (patch: Record<string, any>) => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("conversation_threads")
      .update(patch)
      .eq("id", thread.id);
    setSaving(false);
    if (error) {
      toast.error("Kunne ikke oppdatere tråd");
      return false;
    }
    onUpdate(patch);
    return true;
  };

  const handleToggleClose = async () => {
    if (isClosed) {
      const ok = await updateThread({ status: "open", closed_at: null, closed_by: null });
      if (ok) {
        // Insert system post
        const { data: ua } = await supabase
          .from("user_accounts")
          .select("id")
          .eq("auth_user_id", user!.id)
          .eq("is_active", true)
          .maybeSingle();
        await (supabase as any).from("conversation_posts").insert({
          thread_id: thread.id,
          company_id: thread.company_id,
          author_id: ua?.id || null,
          post_type: "system",
          body_text: "Tråden ble gjenåpnet",
        });
        toast.success("Tråd gjenåpnet");
      }
    } else {
      const ok = await updateThread({ status: "closed", closed_at: new Date().toISOString(), closed_by: user!.id });
      if (ok) {
        const { data: ua } = await supabase
          .from("user_accounts")
          .select("id")
          .eq("auth_user_id", user!.id)
          .eq("is_active", true)
          .maybeSingle();
        await (supabase as any).from("conversation_posts").insert({
          thread_id: thread.id,
          company_id: thread.company_id,
          author_id: ua?.id || null,
          post_type: "system",
          body_text: "Tråden ble lukket",
        });
        toast.success("Tråd lukket");
      }
    }
  };

  const handleSetCategory = async (cat: string) => {
    const labels: Record<string, string> = { normal: "Normal", risk: "Risiko", change: "Endring" };
    const ok = await updateThread({ thread_category: cat });
    if (ok) {
      const { data: ua } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("auth_user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();
      await (supabase as any).from("conversation_posts").insert({
        thread_id: thread.id,
        company_id: thread.company_id,
        author_id: ua?.id || null,
        post_type: "system",
        body_text: `Trådtype endret til: ${labels[cat]}`,
      });
      toast.success(`Type satt til ${labels[cat]}`);
    }
  };

  const handleMarkDecision = async () => {
    if (!decisionSummary.trim()) return;
    setSaving(true);
    const ok = await updateThread({
      is_formal_decision: true,
      decision_summary: decisionSummary.trim(),
      decision_marked_by: user!.id,
      decision_marked_at: new Date().toISOString(),
    });
    if (ok) {
      const { data: ua } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("auth_user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();
      await (supabase as any).from("conversation_posts").insert({
        thread_id: thread.id,
        company_id: thread.company_id,
        author_id: ua?.id || null,
        post_type: "system",
        body_text: `Formell beslutning: ${decisionSummary.trim()}`,
      });
      toast.success("Beslutning registrert");
    }
    setDecisionOpen(false);
    setDecisionSummary("");
    setSaving(false);
  };

  const handleExportPdf = async () => {
    toast.info("PDF-eksport er under utvikling");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg h-8" disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Administrer
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Status
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleToggleClose} className="gap-2 text-xs">
            {isClosed ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {isClosed ? "Gjenåpne tråd" : "Lukk tråd"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Type
          </DropdownMenuLabel>
          {(["normal", "risk", "change"] as const).map((cat) => {
            const icons = { normal: MessageSquare, risk: AlertTriangle, change: Repeat };
            const labels = { normal: "Normal", risk: "Risiko", change: "Endring" };
            const Icon = icons[cat];
            return (
              <DropdownMenuItem
                key={cat}
                onClick={() => handleSetCategory(cat)}
                className="gap-2 text-xs"
                disabled={category === cat}
              >
                <Icon className="h-3.5 w-3.5" />
                {labels[cat]}
                {category === cat && <Badge variant="secondary" className="ml-auto text-[8px] px-1">Aktiv</Badge>}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDecisionOpen(true)}
            className="gap-2 text-xs"
            disabled={thread.is_formal_decision}
          >
            <Gavel className="h-3.5 w-3.5" />
            {thread.is_formal_decision ? "Beslutning registrert" : "Merk som beslutning"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExportPdf} className="gap-2 text-xs">
            <FileDown className="h-3.5 w-3.5" />
            Eksporter PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Decision dialog */}
      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrer formell beslutning</DialogTitle>
            <DialogDescription>
              Beskriv beslutningen som er tatt i denne samtalen.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={decisionSummary}
            onChange={(e) => setDecisionSummary(e.target.value)}
            placeholder="Kort oppsummering av beslutningen…"
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionOpen(false)}>Avbryt</Button>
            <Button onClick={handleMarkDecision} disabled={!decisionSummary.trim() || saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Registrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
