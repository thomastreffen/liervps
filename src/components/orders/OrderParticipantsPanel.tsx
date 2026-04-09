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
import { Users, UserPlus, X, User, Mail, Shield, Eye, Bell, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";

interface Participant {
  id: string;
  submission_id: string;
  participant_type: string;
  user_id: string | null;
  name: string;
  email: string | null;
  role_label: string | null;
  receives_notifications: boolean;
  can_reply: boolean;
  is_visible_to_customer: boolean;
  created_at: string;
}

interface Props {
  submissionId: string;
  companyId: string;
}

const ROLE_ICONS: Record<string, typeof User> = {
  "Ansvarlig": Shield,
  "Montør": Wrench,
  "Bestiller": Mail,
  "Kontakt": User,
};

export function OrderParticipantsPanel({ submissionId, companyId }: Props) {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"internal_user" | "external_email">("internal_user");
  const [searchQuery, setSearchQuery] = useState("");
  const [extName, setExtName] = useState("");
  const [extEmail, setExtEmail] = useState("");
  const [extRole, setExtRole] = useState("Kontakt");
  const [extVisible, setExtVisible] = useState(false);

  const { data: participants = [] } = useQuery({
    queryKey: ["order-participants", submissionId],
    enabled: !!submissionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_form_participants")
        .select("*")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Participant[];
    },
  });

  const { data: internalUsers = [] } = useQuery({
    queryKey: ["company-users-participants", activeCompanyId],
    enabled: !!activeCompanyId && addOpen && addType === "internal_user",
    queryFn: async () => {
      const { data } = await supabase
        .from("user_accounts")
        .select("auth_user_id, person:people(full_name, email)")
        .eq("is_active", true);
      return (data || []).filter((u: any) => u.person?.full_name).map((u: any) => ({
        id: u.auth_user_id,
        name: u.person.full_name,
        email: u.person.email,
      }));
    },
  });

  const addParticipant = useMutation({
    mutationFn: async (p: { participant_type: string; user_id?: string; name: string; email?: string; role_label: string; is_visible_to_customer: boolean }) => {
      const existing = participants.find(
        (ep) => (p.user_id && ep.user_id === p.user_id) || (p.email && ep.email === p.email)
      );
      if (existing) throw new Error("Deltaker finnes allerede");

      const { error } = await supabase.from("order_form_participants").insert({
        submission_id: submissionId,
        participant_type: p.participant_type,
        user_id: p.user_id || null,
        name: p.name,
        email: p.email || null,
        role_label: p.role_label,
        is_visible_to_customer: p.is_visible_to_customer,
        receives_notifications: true,
        can_reply: true,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-participants", submissionId] });
      setAddOpen(false);
      setSearchQuery("");
      setExtName("");
      setExtEmail("");
      toast.success("Deltaker lagt til");
    },
    onError: (err: any) => toast.error(err.message || "Kunne ikke legge til deltaker"),
  });

  const removeParticipant = useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await supabase
        .from("order_form_participants")
        .delete()
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-participants", submissionId] });
      toast.success("Deltaker fjernet");
    },
  });

  const filteredUsers = internalUsers.filter(
    (u: any) =>
      (!searchQuery || u.name.toLowerCase().includes(searchQuery.toLowerCase())) &&
      !participants.some((p) => p.user_id === u.id)
  );

  const roleIcon = (label: string | null) => {
    const Icon = ROLE_ICONS[label || ""] || User;
    return <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Deltakere i dialog
          <Badge variant="outline" className="text-[9px] ml-auto">{participants.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {participants.length === 0 && (
          <p className="text-xs text-muted-foreground">Ingen deltakere lagt til ennå</p>
        )}

        {participants.map((p) => (
          <div key={p.id} className="flex items-center gap-2 py-1 group">
            {roleIcon(p.role_label)}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{p.name}</p>
              <div className="flex items-center gap-1.5">
                {p.role_label && (
                  <span className="text-[10px] text-muted-foreground">{p.role_label}</span>
                )}
                {p.is_visible_to_customer && (
                  <span title="Synlig for kunde"><Eye className="h-2.5 w-2.5 text-primary/60" /></span>
                )}
                {p.receives_notifications && (
                  <span title="Mottar varsler"><Bell className="h-2.5 w-2.5 text-muted-foreground" /></span>
                )}
              </div>
            </div>
            <Badge variant="outline" className="text-[8px] shrink-0">
              {p.participant_type === "internal_user" ? "Intern" : p.participant_type === "customer_contact" ? "Kunde" : "Ekstern"}
            </Badge>
            <button
              onClick={() => removeParticipant.mutate(p.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              title="Fjern deltaker"
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}

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
                Intern bruker
              </Button>
              <Button
                size="sm"
                variant={addType === "external_email" ? "default" : "outline"}
                className="text-xs h-7 flex-1"
                onClick={() => setAddType("external_email")}
              >
                Ekstern e-post
              </Button>
            </div>

            {addType === "internal_user" && (
              <>
                <Input
                  placeholder="Søk etter bruker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {filteredUsers.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">Ingen brukere funnet</p>
                  )}
                  {filteredUsers.map((u: any) => (
                    <button
                      key={u.id}
                      className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                      onClick={() => addParticipant.mutate({
                        participant_type: "internal_user",
                        user_id: u.id,
                        name: u.name,
                        email: u.email,
                        role_label: "Intern",
                        is_visible_to_customer: false,
                      })}
                    >
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="flex-1 truncate">{u.name}</span>
                    </button>
                  ))}
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
                  Synlig for kunde i dialogen
                </label>
                <Button
                  size="sm"
                  className="w-full text-xs h-7"
                  disabled={!extName.trim() || !extEmail.trim()}
                  onClick={() => addParticipant.mutate({
                    participant_type: "external_email",
                    name: extName,
                    email: extEmail,
                    role_label: extRole,
                    is_visible_to_customer: extVisible,
                  })}
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