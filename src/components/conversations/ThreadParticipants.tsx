import { useState, useRef } from "react";
import { useThreadParticipants } from "@/hooks/useThreadParticipants";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, Plus, X, Search, UserPlus, Mail, Send, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ThreadParticipantsProps {
  threadId: string;
  companyId: string;
  projectId: string;
  isAdmin: boolean;
  allowParticipantsInvite?: boolean;
}

interface SearchResult {
  id: string;
  full_name: string;
  email: string | null;
}

export function ThreadParticipants({ threadId, companyId, projectId, isAdmin, allowParticipantsInvite = true }: ThreadParticipantsProps) {
  const { participants, loading, addInternal, addExternal, remove } = useThreadParticipants(threadId);
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [externalMode, setExternalMode] = useState(false);
  const [inviteMode, setInviteMode] = useState(false);
  const [extEmail, setExtEmail] = useState("");
  const [extName, setExtName] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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

  // Check if current user is a participant with invite permissions
  const myParticipant = participants.find(p => {
    // Match by user_account_id - we need to check async but for UI we use cached data
    return p.user_account_id !== null;
  });

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
      await addExternal(threadId, companyId, projectId, extEmail.trim(), extName.trim() || extEmail.trim(), myId!);
      toast.success(`${extName.trim() || extEmail.trim()} lagt til`);
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
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Invitasjon sendt til ${extEmail.trim()}`);
      setExtEmail("");
      setExtName("");
      setInviteMode(false);
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke sende invitasjon");
    } finally {
      setSendingInvite(false);
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
    }
  };

  const showAddButton = isAdmin || canInvite;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {participants.length} {participants.length === 1 ? "deltaker" : "deltakere"}
        </span>

        {showAddButton && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="end">
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
                    <Button size="sm" className="w-full h-7 text-xs" onClick={handleSendInvite} disabled={!extEmail.trim() || sendingInvite}>
                      <Send className="h-3 w-3 mr-1" />
                      {sendingInvite ? "Sender…" : "Send invitasjon"}
                    </Button>
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
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Participant chips */}
      {participants.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {participants.map(p => (
            <Popover key={p.id}>
              <PopoverTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] gap-1 pr-1 cursor-pointer hover:bg-muted/50 transition-colors",
                    p.participant_type === "external" ? "border-accent/30 text-accent" : "border-primary/30 text-primary"
                  )}
                >
                  {p.full_name || p.display_name || p.email || "Ukjent"}
                  {((p as any).can_invite_external || (p as any).can_invite_internal) && (
                    <Send className="h-2 w-2 text-muted-foreground" />
                  )}
                  {isAdmin && (
                    <button onClick={(e) => { e.stopPropagation(); handleRemove(p); }} className="ml-0.5 hover:text-destructive transition-colors">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </Badge>
              </PopoverTrigger>
              {isAdmin && (
                <PopoverContent className="w-56 p-3" align="start">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold">{p.full_name || p.display_name || p.email}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Kan invitere interne</span>
                        <Switch
                          checked={(p as any).can_invite_internal || false}
                          onCheckedChange={(v) => toggleInvitePermission(p.id, "can_invite_internal", v)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Kan invitere eksterne</span>
                        <Switch
                          checked={(p as any).can_invite_external || false}
                          onCheckedChange={(v) => toggleInvitePermission(p.id, "can_invite_external", v)}
                        />
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              )}
            </Popover>
          ))}
        </div>
      )}
    </div>
  );
}
