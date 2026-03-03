import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Lock, Unlock, Gavel, AlertTriangle, Repeat, MessageSquare,
  Link2, FileDown, Loader2, ListTodo, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<any[]>([]);
  const [linkSearching, setLinkSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!isAdmin) return null;

  const isClosed = thread.status === "closed";
  const category = thread.thread_category || "normal";

  const getMyAccountId = async () => {
    if (!user) return null;
    const { data } = await supabase
      .from("user_accounts")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    return data?.id || null;
  };

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

  const insertSystemPost = async (text: string) => {
    const authorId = await getMyAccountId();
    await (supabase as any).from("conversation_posts").insert({
      thread_id: thread.id,
      company_id: thread.company_id,
      author_id: authorId,
      post_type: "system",
      body_text: text,
    });
  };

  const handleToggleClose = async () => {
    if (isClosed) {
      const ok = await updateThread({ status: "open", closed_at: null, closed_by: null });
      if (ok) {
        await insertSystemPost("Tråden ble gjenåpnet");
        toast.success("Tråd gjenåpnet");
      }
    } else {
      const ok = await updateThread({ status: "closed", closed_at: new Date().toISOString(), closed_by: user!.id });
      if (ok) {
        await insertSystemPost("Tråden ble lukket");
        toast.success("Tråd lukket");
      }
    }
  };

  const handleSetCategory = async (cat: string) => {
    const labels: Record<string, string> = { normal: "Normal", risk: "Risiko", change: "Endring" };
    const ok = await updateThread({ thread_category: cat });
    if (ok) {
      await insertSystemPost(`Trådtype endret til: ${labels[cat]}`);
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
      await insertSystemPost(`Formell beslutning: ${decisionSummary.trim()}`);
      toast.success("Beslutning registrert");
    }
    setDecisionOpen(false);
    setDecisionSummary("");
    setSaving(false);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { toast.error("Ikke autentisert"); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/conversation-export-pdf`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ thread_id: thread.id }),
        }
      );

      if (!resp.ok) {
        toast.error("Eksport feilet");
        return;
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `samtale-${thread.id.slice(0, 8)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Eksport lastet ned");
    } catch {
      toast.error("Eksport feilet");
    } finally {
      setExporting(false);
    }
  };

  // Offer/order search
  const handleLinkSearch = async (q: string) => {
    setLinkSearch(q);
    if (q.trim().length < 2) { setLinkResults([]); return; }
    setLinkSearching(true);

    const { data: offers } = await supabase
      .from("offers")
      .select("id, offer_number, calculations:calculation_id(project_title, customer_name)")
      .ilike("offer_number", `%${q}%`)
      .limit(5);

    setLinkResults((offers || []).map((o: any) => {
      const calc = Array.isArray(o.calculations) ? o.calculations[0] : o.calculations;
      return {
        id: o.id,
        type: "offer",
        label: `${o.offer_number || ""} – ${calc?.project_title || calc?.customer_name || ""}`,
      };
    }));
    setLinkSearching(false);
  };

  const handleLinkSelect = async (item: any) => {
    const patch = item.type === "offer"
      ? { linked_offer_id: item.id }
      : { linked_order_id: item.id };
    const ok = await updateThread(patch);
    if (ok) {
      await insertSystemPost(`Koblet til tilbud: ${item.label}`);
      toast.success("Kobling opprettet");
    }
    setLinkOpen(false);
    setLinkSearch("");
    setLinkResults([]);
  };

  const handleCreateTask = async () => {
    setSaving(true);
    try {
      // Get first post for description
      const { data: firstPost } = await (supabase as any)
        .from("conversation_posts")
        .select("body_text")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const desc = firstPost?.body_text
        ? `${firstPost.body_text.slice(0, 300)}...\n\nFra samtale: ${thread.title}`
        : `Fra samtale: ${thread.title}`;

      const { error } = await supabase.from("job_tasks").insert({
        job_id: thread.project_id,
        title: thread.title,
        description: desc,
        status: "pending",
        created_by: user!.id,
      });

      if (error) throw error;
      await insertSystemPost(`Oppgave opprettet: ${thread.title}`);
      toast.success("Oppgave opprettet fra samtale");
    } catch {
      toast.error("Kunne ikke opprette oppgave");
    }
    setSaving(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg h-8" disabled={saving || exporting}>
            {(saving || exporting) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
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
          <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Koblinger
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setLinkOpen(true)} className="gap-2 text-xs">
            <Link2 className="h-3.5 w-3.5" />
            Koble til tilbud
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCreateTask} className="gap-2 text-xs">
            <ListTodo className="h-3.5 w-3.5" />
            Opprett oppgave fra tråd
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExportPdf} className="gap-2 text-xs" disabled={exporting}>
            <FileDown className="h-3.5 w-3.5" />
            {exporting ? "Eksporterer…" : "Eksporter PDF"}
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

      {/* Link to offer dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Koble til tilbud</DialogTitle>
            <DialogDescription>
              Søk etter et tilbud for å koble til denne samtalen.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søk tilbudsnummer eller navn…"
              value={linkSearch}
              onChange={(e) => handleLinkSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          {linkSearching && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Søker…
            </div>
          )}
          {linkResults.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {linkResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleLinkSelect(r)}
                  className="flex items-center gap-2 w-full text-left rounded-lg px-3 py-2.5 hover:bg-muted/60 transition-colors border border-transparent hover:border-border/40"
                >
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{r.label}</span>
                </button>
              ))}
            </div>
          )}
          {linkSearch.length >= 2 && !linkSearching && linkResults.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Ingen treff</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLinkOpen(false); setLinkSearch(""); setLinkResults([]); }}>
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
