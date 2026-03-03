import { useState, useRef, useEffect } from "react";
import { useThreadParticipants } from "@/hooks/useThreadParticipants";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, Plus, X, Search, UserPlus, Mail, Send, Clock, RotateCw, Ban, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ThreadParticipantsProps {
  threadId: string;
  companyId: string;
  projectId: string;
  isAdmin: boolean;
  allowParticipantsInvite?: boolean;
  compact?: boolean;
}

interface SearchResult {
  id: string;
  full_name: string;
  email: string | null;
}

interface PendingInvite {
  id: string;
  invited_email: string;
  invited_name: string | null;
  status: string;
  expires_at: string;
  created_at: string;
}

export function ThreadParticipants({ threadId, companyId, projectId, isAdmin, allowParticipantsInvite = true, compact = false }: ThreadParticipantsProps) {
  const { participants, loading, addInternal, addExternal, remove, refresh } = useThreadParticipants(threadId);
  const { user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [externalMode, setExternalMode] = useState(false);
  const [inviteMode, setInviteMode] = useState(false);
  const [extEmail, setExtEmail] = useState("");
  const [extName, setExtName] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [lockThread, setLockThread] = useState(true);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch pending invites
  useEffect(() => {
    if (!threadId || !isAdmin) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("conversation_thread_invites")
        .select("id, invited_email, invited_name, status, expires_at, created_at")
        .eq("thread_id", threadId)
        .in("status", ["pending"])
        .order("created_at", { ascending: false });
      setPendingInvites(data ?? []);
    })();
  }, [threadId, isAdmin, sendingInvite]);

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

  const myParticipant = participants.find(p => p.user_account_id !== null);

  const canInvite = isAdmin || (allowParticipantsInvite && myParticipant && (
    (myParticipant as any).can_invite_external || (myParticipant as any).can_invite_internal
  ));

  const handleSearch = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("user_accounts")
        .select("id, people:people!user_accounts_person_id_fkey(full_name, email)")
        .eq("is_active", true)
        .eq("company_id", companyId);

      const existing = new Set(participants.filter(p => p.user_account_id).map(p => p.user_account_id));
      const filtered = ((data as any[]) ?? [])
        .map(a => {
          const person = Array.isArray(a.people) ? a.people[0] : a.people;
          return { id: a.id, full_name: person?.full_name || "Ukjent", email: person?.email || null };
        })
        .filter(r => !existing.has(r.id))
        .filter(r => r.full_name.toLowerCase().includes(value.toLowerCase()) || (r.email && r.email.toLowerCase().includes(value.toLowerCase())));

      setResults(filtered);
      setSearching(false);
    }, 300);
  };

  const handleAddInternal = async (result: SearchResult) => {
    try {
      const myId = await getMyAccountId();
      await addInternal(threadId, companyId, projectId, result.id, myId!);
      toast.success(`${result.full_name} lagt til`);
      setSearch("");
      setResults([]);
    } catch {
      toast.error("Kunne ikke legge til deltaker");
    }
  };

  const handleAddExternal = async () => {
    if (!extEmail.trim()) return;
    try {
      const myId = await getMyAccountId();
      const result = await addExternal(threadId, companyId, projectId, extEmail.trim(), extName.trim() || extEmail.trim(), myId!);

      // Server handles welcome email atomically – just show result
      if (result?.email_result?.sent) {
        toast.success(`${extName.trim() || extEmail.trim()} lagt til – historikk sendt`);
      } else if (result?.email_result?.skipped) {
        toast.success(`${extName.trim() || extEmail.trim()} lagt til`);
      } else if (result?.email_result?.error) {
        toast.success(`${extName.trim() || extEmail.trim()} lagt til`);
        toast.warning(`Kunne ikke sende historikk: ${result.email_result.error}`);
      } else {
        toast.success(`${extName.trim() || extEmail.trim()} lagt til`);
      }

      setExtEmail("");
      setExtName("");
      setExternalMode(false);
    } catch {
      toast.error("Kunne ikke legge til ekstern deltaker");
    }
  };

  const handleSendInvite = async () => {
    if (!extEmail.trim()) return;
    setSendingInvite(true);
    try {
      const { data, error } = await supabase.functions.invoke("conversation-invite-send", {
        body: {
          thread_id: threadId,
          invited_email: extEmail.trim(),
          invited_name: extName.trim() || null,
          invite_type: "external",
          lock_thread: lockThread,
        },
      });
      if (error) throw error;
      if (data?.error === "already_participant") {
        toast.info(data.message || "Allerede deltaker");
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        toast.success(data?.resent
          ? `Invitasjon sendt på nytt til ${extEmail.trim()}`
          : `Invitasjon sendt til ${extEmail.trim()}`
        );
        setExtEmail("");
        setExtName("");
        setInviteMode(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke sende invitasjon");
    } finally {
      setSendingInvite(false);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("conversation-invite-send", {
        body: { action: "resend", invite_id: inviteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Invitasjon sendt på nytt");
      // Refresh invites
      setSendingInvite(prev => !prev);
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke sende på nytt");
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("conversation-invite-send", {
        body: { action: "revoke", invite_id: inviteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Invitasjon trukket tilbake");
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke trekke tilbake");
    }
  };

  const handleRemove = async (p: typeof participants[0]) => {
    try {
      await remove(p.id);
      toast.success("Deltaker fjernet");
    } catch {
      toast.error("Kunne ikke fjerne deltaker");
    }
  };

  const toggleInvitePermission = async (participantId: string, key: "can_invite_internal" | "can_invite_external", value: boolean) => {
    const { error } = await (supabase as any)
      .from("conversation_thread_participants")
      .update({ [key]: value })
      .eq("id", participantId);
    if (error) {
      toast.error("Kunne ikke oppdatere rettighet");
    } else {
      toast.success("Rettighet oppdatert");
      refresh();
    }
  };

  const showAddButton = isAdmin || canInvite;

  // ── Add participant panel content (shared between Sheet and Popover) ──
  const addParticipantContent = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold flex-1">Legg til deltaker</h4>
        {isAdmin && (
          <Button
            variant={externalMode ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2 gap-1"
            onClick={() => { setExternalMode(!externalMode); setInviteMode(false); }}
          >
            <Mail className="h-3 w-3" />
            Ekstern
          </Button>
        )}
        {(canInvite || isAdmin) && (
          <Button
            variant={inviteMode ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2 gap-1"
            onClick={() => { setInviteMode(!inviteMode); setExternalMode(false); }}
          >
            <Send className="h-3 w-3" />
            Inviter
          </Button>
        )}
      </div>

      {inviteMode ? (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Send en invitasjonslenke per e-post. Mottakeren får kun tilgang til denne samtalen.
          </p>
          <Input
            placeholder="E-postadresse"
            value={extEmail}
            onChange={e => setExtEmail(e.target.value)}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Navn (valgfritt)"
            value={extName}
            onChange={e => setExtName(e.target.value)}
            className="h-8 text-xs"
          />
          <label className="flex items-start gap-2 cursor-pointer rounded-md border border-border/40 p-2 bg-muted/30">
            <Checkbox
              checked={lockThread}
              onCheckedChange={(v) => setLockThread(!!v)}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Lås tråden til kun deltakere
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Andre prosjektmedlemmer mister tilgang. Slå av dersom de fortsatt skal kunne se.
              </span>
            </div>
          </label>
          <Button size="sm" className="w-full h-7 text-xs" onClick={handleSendInvite} disabled={!extEmail.trim() || sendingInvite}>
            <Send className="h-3 w-3 mr-1" />
            {sendingInvite ? "Sender…" : "Send invitasjon"}
          </Button>
          <p className="text-[9px] text-muted-foreground/70 text-center pt-1">
            Invitasjoner sendes fra postkontoret@mcsservice.no. Mottaker ser hvem som inviterte.
          </p>
        </div>
      ) : externalMode ? (
        <div className="space-y-2">
          <Input
            placeholder="E-postadresse"
            value={extEmail}
            onChange={e => setExtEmail(e.target.value)}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Navn (valgfritt)"
            value={extName}
            onChange={e => setExtName(e.target.value)}
            className="h-8 text-xs"
          />
          <Button size="sm" className="w-full h-7 text-xs" onClick={handleAddExternal} disabled={!extEmail.trim()}>
            <UserPlus className="h-3 w-3 mr-1" />
            Legg til ekstern
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Søk ansatt…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="h-8 text-xs pl-7"
              autoFocus
            />
          </div>
          {results.length > 0 && (
            <div className="max-h-40 overflow-y-auto divide-y divide-border/30 rounded-md border border-border/50">
              {results.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleAddInternal(r)}
                  className="flex items-center gap-2 w-full text-left px-2.5 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {r.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{r.full_name}</p>
                    {r.email && <p className="text-[10px] text-muted-foreground truncate">{r.email}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
          {search.length >= 2 && results.length === 0 && !searching && (
            <p className="text-[10px] text-muted-foreground text-center py-2">Ingen treff</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {participants.length} {participants.length === 1 ? "deltaker" : "deltakere"}
        </span>

        {showAddButton && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 ml-auto">
                <UserPlus className="h-3.5 w-3.5" />
                Legg til deltaker
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[340px] sm:w-[380px]">
              <SheetHeader>
                <SheetTitle className="text-base">Deltakere</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {addParticipantContent}

                {/* Current participants list in sheet */}
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Nåværende deltakere</p>
                  {participants.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                          p.participant_type === "external" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                        )}>
                          {(p.full_name || p.display_name || p.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{p.full_name || p.display_name || p.email || "Ukjent"}</p>
                          {p.email && <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {p.participant_type === "external" ? "Ekstern" : "Intern"}
                        </Badge>
                        {isAdmin && (
                          <button onClick={() => handleRemove(p)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pending invites in sheet */}
                {pendingInvites.length > 0 && (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Ventende invitasjoner
                    </p>
                    {pendingInvites.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between gap-2 py-1.5">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{inv.invited_name || inv.invited_email}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{inv.invited_email}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleResendInvite(inv.id)}>
                            <RotateCw className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => handleRevokeInvite(inv.id)}>
                            <Ban className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Participant chips (compact: just avatars, full: badges) */}
      {participants.length > 0 && !compact && (
        <div className="flex flex-wrap gap-1.5">
          {participants.map(p => (
            <Badge
              key={p.id}
              variant="outline"
              className={cn(
                "text-[10px] gap-1 cursor-default",
                p.participant_type === "external" ? "border-accent/30 text-accent" : "border-primary/30 text-primary"
              )}
            >
              {p.full_name || p.display_name || p.email || "Ukjent"}
              {((p as any).can_invite_external || (p as any).can_invite_internal) && (
                <Send className="h-2 w-2 text-muted-foreground" />
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
