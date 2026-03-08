import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/hooks/usePortal";
import { Users, Mail, Send, Loader2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  portal_role: string;
  status: string;
  last_login_at: string | null;
}

export default function PortalTeam() {
  const { user, isCustomerAdmin } = usePortal();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);

  const loadMembers = async () => {
    if (!user?.accountId) { setLoading(false); return; }

    const { data } = await supabase
      .from("customer_portal_users")
      .select("id, email, full_name, portal_role, status, last_login_at")
      .eq("account_id", user.accountId)
      .order("created_at");

    setMembers(data || []);
    setLoading(false);
  };

  useEffect(() => { loadMembers(); }, [user]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !user?.accountId) return;
    setInviting(true);

    try {
      const { data, error } = await supabase.functions.invoke("customer-portal-invite", {
        body: {
          email: inviteEmail.trim(),
          full_name: inviteName.trim() || null,
          account_id: user.accountId,
          portal_role: "customer_user",
          invited_by_portal_user: true,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Invitasjon sendt!");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke sende invitasjon");
    } finally {
      setInviting(false);
    }
  };

  const roleLabel = (r: string) => {
    switch (r) {
      case "customer_admin": return "Administrator";
      case "customer_finance": return "Økonomi";
      default: return "Bruker";
    }
  };

  if (!isCustomerAdmin) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Kun administratorer kan administrere teamet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Teammedlemmer</h2>
        <Button onClick={() => setInviteOpen(true)} size="sm">
          <UserPlus className="mr-1.5 h-4 w-4" />
          Inviter bruker
        </Button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted" />)}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Ingen teammedlemmer ennå.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                    {(m.full_name || m.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">
                      {m.full_name || m.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {roleLabel(m.portal_role)}
                  </Badge>
                  <Badge
                    variant={m.status === "active" ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {m.status === "active" ? "Aktiv" : m.status === "pending" ? "Venter" : "Deaktivert"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inviter teammedlem</DialogTitle>
            <DialogDescription>
              Personen mottar en innloggingslenke per e-post.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>E-post *</Label>
              <Input
                type="email"
                placeholder="kollega@firma.no"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Navn</Label>
              <Input
                placeholder="Ola Nordmann"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send invitasjon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
