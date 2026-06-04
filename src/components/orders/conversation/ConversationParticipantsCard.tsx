import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, UserPlus, X, User, Mail, Shield, Wrench, Eye, Bell } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useConversationReads, type ConversationParticipant } from "@/hooks/useConversationReads";
import { format, formatDistanceToNowStrict } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  submissionId: string;
  companyId: string;
  /** ID of the latest message visible to internal users (or to anyone). */
  latestMessageId?: string | null;
}

const ROLE_ICONS: Record<string, typeof User> = {
  Ansvarlig: Shield,
  Montør: Wrench,
  Bestiller: Mail,
  Kontakt: User,
  Intern: User,
};

function lastSeenLabel(p: ConversationParticipant, latestMessageId: string | null | undefined): {
  label: string;
  tone: "ok" | "muted" | "warn";
} {
  if (!p.last_seen_at) return { label: "Aldri åpnet", tone: "muted" };
  const seen = new Date(p.last_seen_at);
  const diffMs = Date.now() - seen.getTime();
  const recent =
    diffMs < 60_000
      ? "nå nettopp"
      : diffMs < 24 * 3600_000
      ? `kl. ${format(seen, "HH:mm")}`
      : `${formatDistanceToNowStrict(seen, { locale: nb })} siden`;

  if (latestMessageId && p.last_seen_message_id !== latestMessageId) {
    return { label: `Sist sett ${recent} · Ikke lest siste`, tone: "warn" };
  }
  return { label: `Lest ${recent}`, tone: "ok" };
}

function typeBadge(p: ConversationParticipant) {
  if (p.participant_type === "customer" || p.participant_type === "customer_contact") {
    return (
      <Badge variant="outline" className="text-[8px] shrink-0 bg-green-50 text-green-700 border-green-200">
        Kunde
      </Badge>
    );
  }
  if (p.participant_type === "technician") {
    return (
      <Badge variant="outline" className="text-[8px] shrink-0 bg-blue-50 text-blue-700 border-blue-200">
        Montør
      </Badge>
    );
  }
  if (p.participant_type === "external_email") {
    return (
      <Badge variant="outline" className="text-[8px] shrink-0">
        Ekstern
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[8px] shrink-0">
      Intern
    </Badge>
  );
}

export function ConversationParticipantsCard({ submissionId, companyId, latestMessageId }: Props) {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"internal_user" | "technician" | "external_email">("internal_user");
  const [searchQuery, setSearchQuery] = useState("");
  const [extName, setExtName] = useState("");
  const [extEmail, setExtEmail] = useState("");
  const [extRole, setExtRole] = useState("Kontakt");
  const [extVisible, setExtVisible] = useState(false);

  const { participants } = useConversationReads({
    submissionId,
    visibleMessageIds: [],
    enableInternalMarkRead: false,
  });

  const { data: internalUsers = [] } = useQuery({
    queryKey: ["company-users-participants", activeCompanyId],
    enabled: !!activeCompanyId && addOpen && addType === "internal_user",
    queryFn: async () => {
      const { data } = await supabase
        .from("user_accounts")
        .select("auth_user_id, person:people(full_name, email)")
        .eq("is_active", true);
      return (data || [])
        .filter((u: any) => u.person?.full_name)
        .map((u: any) => ({ id: u.auth_user_id, name: u.person.full_name, email: u.person.email }));
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["company-technicians-participants", companyId],
    enabled: !!companyId && addOpen && addType === "technician",
    queryFn: async () => {
      const { data } = await supabase
        .from("technicians")
        .select("id, name, email, user_id")
        .eq("company_id", companyId)
        .eq("is_active", true);
      return (data || []) as Array<{ id: string; name: string; email: string | null; user_id: string | null }>;
    },
  });

  const addInternal = useMutation({
    mutationFn: async (p: { user_id: string; display_name: string; email?: string | null }) => {
      const { error } = await supabase.rpc("upsert_internal_conversation_participant" as any, {
        _submission_id: submissionId,
        _user_id: p.user_id,
        _technician_id: null,
        _display_name: p.display_name,
        _email: p.email || null,
        _phone: null,
        _role_label: "Intern",
        _visibility: "internal",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-participants", submissionId] });
      setAddOpen(false);
      setSearchQuery("");
      toast.success("Deltaker lagt til");
    },
    onError: (err: any) => toast.error(err.message || "Kunne ikke legge til"),
  });

  const addTechnician = useMutation({
    mutationFn: async (t: { technician_id: string; display_name: string; email: string | null; user_id: string | null }) => {
      const { error } = await supabase.rpc("upsert_internal_conversation_participant" as any, {
        _submission_id: submissionId,
        _user_id: t.user_id,
        _technician_id: t.technician_id,
        _display_name: t.display_name,
        _email: t.email,
        _phone: null,
        _role_label: "Montør",
        _visibility: "internal",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-participants", submissionId] });
      setAddOpen(false);
      setSearchQuery("");
      toast.success("Montør lagt til");
    },
    onError: (err: any) => toast.error(err.message || "Kunne ikke legge til montør"),
  });

  const addExternal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("order_form_participants").insert({
        submission_id: submissionId,
        participant_type: "external_email",
        name: extName,
        display_name: extName,
        email: extEmail,
        role_label: extRole,
        visibility: extVisible ? "shared_with_customer" : "internal",
        is_visible_to_customer: extVisible,
        receives_notifications: true,
        can_reply: true,
        added_by: user?.id,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-participants", submissionId] });
      setAddOpen(false);
      setExtName("");
      setExtEmail("");
      toast.success("Ekstern deltaker lagt til");
    },
    onError: (err: any) => toast.error(err.message || "Kunne ikke legge til"),
  });

  const removeParticipant = useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await supabase.rpc("deactivate_conversation_participant" as any, {
        _participant_id: participantId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-participants", submissionId] });
      toast.success("Deltaker fjernet");
    },
  });

  const filteredUsers = internalUsers.filter(
    (u: any) =>
      (!searchQuery || u.name.toLowerCase().includes(searchQuery.toLowerCase())) &&
      !participants.some((p) => p.user_id === u.id),
  );

  const filteredTechs = technicians.filter(
    (t) =>
      (!searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase())) &&
      !participants.some((p) => p.technician_id === t.id),
  );

  const roleIcon = (p: ConversationParticipant) => {
    const Icon = ROLE_ICONS[p.role_label || ""] || User;
    return <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Deltakere i dialog
          <Badge variant="outline" className="text-[9px] ml-auto">
            {participants.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {participants.length === 0 && (
          <p className="text-xs text-muted-foreground">Ingen deltakere ennå</p>
        )}

        {participants.map((p) => {
          const seen = lastSeenLabel(p, latestMessageId);
          return (
            <div key={p.id} className="flex items-center gap-2 py-1 group">
              {roleIcon(p)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{p.display_name || p.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {p.role_label && (
                    <span className="text-[10px] text-muted-foreground">{p.role_label}</span>
                  )}
                  <span
                    className={cn(
                      "text-[10px]",
                      seen.tone === "ok" && "text-primary",
                      seen.tone === "warn" && "text-amber-700",
                      seen.tone === "muted" && "text-muted-foreground",
                    )}
                  >
                    · {seen.label}
                  </span>
                  {p.visibility === "shared_with_customer" && (
                    <span title="Synlig for kunde">
                      <Eye className="h-2.5 w-2.5 text-primary/60" />
                    </span>
                  )}
                </div>
              </div>
              {typeBadge(p)}
              <button
                onClick={() => removeParticipant.mutate(p.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                title="Fjern deltaker"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          );
        })}

        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full text-xs h-7 mt-1">
              <UserPlus className="h-3 w-3 mr-1" />
              Legg til deltaker
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-3 space-y-3">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={addType === "internal_user" ? "default" : "outline"}
                className="text-xs h-7 flex-1"
                onClick={() => setAddType("internal_user")}
              >
                Intern
              </Button>
              <Button
                size="sm"
                variant={addType === "technician" ? "default" : "outline"}
                className="text-xs h-7 flex-1"
                onClick={() => setAddType("technician")}
              >
                Montør
              </Button>
              <Button
                size="sm"
                variant={addType === "external_email" ? "default" : "outline"}
                className="text-xs h-7 flex-1"
                onClick={() => setAddType("external_email")}
              >
                Ekstern
              </Button>
            </div>

            {(addType === "internal_user" || addType === "technician") && (
              <>
                <Input
                  placeholder="Søk..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {addType === "internal_user" &&
                    filteredUsers.map((u: any) => (
                      <button
                        key={u.id}
                        className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                        onClick={() =>
                          addInternal.mutate({ user_id: u.id, display_name: u.name, email: u.email })
                        }
                      >
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="flex-1 truncate">{u.name}</span>
                      </button>
                    ))}
                  {addType === "internal_user" && filteredUsers.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">Ingen brukere</p>
                  )}
                  {addType === "technician" &&
                    filteredTechs.map((t) => (
                      <button
                        key={t.id}
                        className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                        onClick={() =>
                          addTechnician.mutate({
                            technician_id: t.id,
                            display_name: t.name,
                            email: t.email,
                            user_id: t.user_id,
                          })
                        }
                      >
                        <Wrench className="h-3 w-3 text-muted-foreground" />
                        <span className="flex-1 truncate">{t.name}</span>
                      </button>
                    ))}
                  {addType === "technician" && filteredTechs.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">Ingen montører</p>
                  )}
                </div>
              </>
            )}

            {addType === "external_email" && (
              <>
                <Input
                  placeholder="Navn"
                  value={extName}
                  onChange={(e) => setExtName(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Input
                  placeholder="E-post"
                  type="email"
                  value={extEmail}
                  onChange={(e) => setExtEmail(e.target.value)}
                  className="h-8 text-sm"
                />
                <Select value={extRole} onValueChange={setExtRole}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kontakt">Kontakt</SelectItem>
                    <SelectItem value="Montør">Montør</SelectItem>
                    <SelectItem value="Prosjektleder">Prosjektleder</SelectItem>
                    <SelectItem value="Annet">Annet</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={extVisible}
                    onCheckedChange={(c) => setExtVisible(!!c)}
                    className="h-3.5 w-3.5"
                  />
                  Synlig for kunde
                  <Bell className="h-3 w-3 ml-auto" />
                </label>
                <Button
                  size="sm"
                  className="w-full text-xs h-7"
                  disabled={!extName.trim() || !extEmail.trim()}
                  onClick={() => addExternal.mutate()}
                >
                  Legg til
                </Button>
              </>
            )}
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}
