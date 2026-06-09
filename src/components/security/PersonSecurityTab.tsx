import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SecurityStatusBadge } from "./SecurityStatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

interface Profile {
  id: string;
  person_id: string;
  clearance_status: string;
  clearance_level: string | null;
  clearance_valid_until: string | null;
  pob_status: string;
  nda_status: string;
  sensitive_note: string | null;
}

interface Authorization {
  id: string;
  person_id: string;
  customer_name: string;
  authorization_status: string;
  interview_date: string | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
}

const CLEARANCE_STATUSES = ["unknown", "needs_check", "clearance_valid", "expired", "blocked"];
const POB_STATUSES = ["not_required", "needs_check", "pob_required", "approved", "expired"];
const NDA_STATUSES = ["not_required", "needs_check", "authorization_required", "approved", "expired"];
const AUTH_STATUSES = ["not_started", "pending_customer", "needs_check", "approved", "expired", "blocked"];

async function writeAudit(action: string, targetType: string, targetId: string, metadata?: any) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await (supabase as any).from("security_audit_log").insert({
      actor_user_id: sess?.session?.user?.id ?? null,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata: metadata ?? null,
    });
    if (error && import.meta.env.DEV) {
      console.warn("[security audit] insert failed (non-blocking):", error.message);
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[security audit] exception (non-blocking):", err);
  }
}

interface Props {
  personId: string;
}

export function PersonSecurityTab({ personId }: Props) {
  const { hasPermission } = usePermissions();
  const { isSuperAdmin } = useAuth();
  const canManage = isSuperAdmin || hasPermission("security.manage");
  const canView = canManage || hasPermission("security.view");
  const canViewSensitive = isSuperAdmin || hasPermission("security.sensitive.view") || hasPermission("security.manage");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [auths, setAuths] = useState<Authorization[]>([]);
  const [saving, setSaving] = useState(false);

  // New authorization form
  const [newCustomer, setNewCustomer] = useState("");
  const [newStatus, setNewStatus] = useState("not_started");
  const [newInterview, setNewInterview] = useState("");
  const [newValid, setNewValid] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const load = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [p, a] = await Promise.all([
        (supabase as any).from("person_security_profiles").select("*").eq("person_id", personId).maybeSingle(),
        (supabase as any)
          .from("person_customer_authorizations")
          .select("*")
          .eq("person_id", personId)
          .order("created_at", { ascending: false }),
      ]);
      if (p?.error) throw p.error;
      if (a?.error) throw a.error;
      setProfile((p?.data as Profile) ?? null);
      setAuths(((a?.data as Authorization[]) ?? []).filter(Boolean));
    } catch (err: any) {
      setLoadError(err?.message ?? "Kunne ikke laste sikkerhetsdata");
      setProfile(null);
      setAuths([]);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    load();
  }, [load]);

  const createProfile = async () => {
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from("person_security_profiles")
      .insert({ person_id: personId })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Kunne ikke opprette profil", { description: error.message });
      return;
    }
    setProfile(data as Profile);
    await writeAudit("profile_created", "person_security_profile", (data as any).id, { person_id: personId });
    toast.success("Sikkerhetsprofil opprettet");
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const payload = {
      clearance_status: profile.clearance_status,
      clearance_level: profile.clearance_level,
      clearance_valid_until: profile.clearance_valid_until,
      pob_status: profile.pob_status,
      nda_status: profile.nda_status,
      sensitive_note: profile.sensitive_note,
    };
    const { error } = await (supabase as any)
      .from("person_security_profiles")
      .update(payload)
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error("Kunne ikke lagre", { description: error.message });
      return;
    }
    await writeAudit("profile_updated", "person_security_profile", profile.id, payload);
    toast.success("Sikkerhetsprofil oppdatert");
  };

  const addAuth = async () => {
    if (!newCustomer.trim()) {
      toast.error("Kundenavn er påkrevd");
      return;
    }
    setSaving(true);
    const payload: any = {
      person_id: personId,
      customer_name: newCustomer.trim(),
      authorization_status: newStatus,
      interview_date: newInterview || null,
      valid_until: newValid || null,
      notes: newNotes || null,
    };
    const { data, error } = await (supabase as any)
      .from("person_customer_authorizations")
      .insert(payload)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Kunne ikke legge til", { description: error.message });
      return;
    }
    setAuths([data as Authorization, ...auths]);
    await writeAudit("authorization_created", "person_customer_authorization", (data as any).id, payload);
    setNewCustomer("");
    setNewStatus("not_started");
    setNewInterview("");
    setNewValid("");
    setNewNotes("");
    toast.success("Kundeautorisasjon lagt til");
  };

  const deleteAuth = async (id: string) => {
    const { error } = await (supabase as any).from("person_customer_authorizations").delete().eq("id", id);
    if (error) {
      toast.error("Kunne ikke slette", { description: error.message });
      return;
    }
    setAuths(auths.filter((a) => a.id !== id));
    await writeAudit("authorization_deleted", "person_customer_authorization", id);
    toast.success("Slettet");
  };

  if (!canView) {
    return (
      <div className="rounded-lg border p-6 max-w-2xl text-sm text-muted-foreground">
        Du har ikke tilgang til å se sikkerhetsdata for denne personen.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 max-w-2xl">
        <p className="text-sm font-medium text-destructive">Kunne ikke laste sikkerhetsdata</p>
        <p className="text-xs text-muted-foreground mt-1">{loadError}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={load}>Prøv igjen</Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-lg border p-6 max-w-2xl">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium">Ingen sikkerhetsprofil</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {canManage
                ? "Opprett en sikkerhetsprofil for å registrere klarering, POB og NDA-status."
                : "Det er ikke registrert en sikkerhetsprofil enda."}
            </p>
            {canManage && (
              <Button onClick={createProfile} disabled={saving} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                {saving ? "Oppretter..." : "Opprett sikkerhetsprofil"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-lg border p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Klarering, POB & NDA</h3>
          <SecurityStatusBadge status={profile.clearance_status} />
        </div>
        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Klareringsstatus</Label>
            <Select
              value={profile.clearance_status}
              onValueChange={(v) => setProfile({ ...profile, clearance_status: v })}
              disabled={!canManage}
            >
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLEARANCE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Klareringsnivå</Label>
            <Input
              value={profile.clearance_level ?? ""}
              onChange={(e) => setProfile({ ...profile, clearance_level: e.target.value || null })}
              placeholder="F.eks. BEGRENSET, KONFIDENSIELT"
              className="mt-1.5"
              disabled={!canManage}
            />
          </div>
          <div>
            <Label>Gyldig til</Label>
            <Input
              type="date"
              value={profile.clearance_valid_until ?? ""}
              onChange={(e) => setProfile({ ...profile, clearance_valid_until: e.target.value || null })}
              className="mt-1.5"
              disabled={!canManage}
            />
          </div>
          <div>
            <Label>POB-status</Label>
            <Select
              value={profile.pob_status}
              onValueChange={(v) => setProfile({ ...profile, pob_status: v })}
              disabled={!canManage}
            >
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POB_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>NDA-status</Label>
            <Select
              value={profile.nda_status}
              onValueChange={(v) => setProfile({ ...profile, nda_status: v })}
              disabled={!canManage}
            >
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NDA_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {canViewSensitive && (
          <div>
            <Label>Intern merknad</Label>
            <Textarea
              value={profile.sensitive_note ?? ""}
              onChange={(e) => setProfile({ ...profile, sensitive_note: e.target.value || null })}
              rows={3}
              className="mt-1.5"
              disabled={!canManage}
            />
          </div>
        )}

        {canManage && (
          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={saving}>
              {saving ? "Lagrer..." : "Lagre"}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Kundeautorisasjoner</h3>
          <span className="text-xs text-muted-foreground">{auths.length} oppføringer</span>
        </div>
        <Separator />

        {auths.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">Ingen kundeautorisasjoner registrert.</p>
        )}

        <div className="space-y-2">
          {auths.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{a.customer_name}</span>
                    <SecurityStatusBadge status={a.authorization_status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-x-3">
                    {a.interview_date && <span>Samtale: {a.interview_date}</span>}
                    {a.valid_until && <span>Gyldig til: {a.valid_until}</span>}
                  </div>
                  {a.notes && <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>}
                </div>
                {canManage && (
                  <Button variant="ghost" size="icon" onClick={() => deleteAuth(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {canManage && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-medium">Legg til kundeautorisasjon</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Kunde</Label>
                  <Input value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUTH_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Samtaledato</Label>
                  <Input type="date" value={newInterview} onChange={(e) => setNewInterview(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>Gyldig til</Label>
                  <Input type="date" value={newValid} onChange={(e) => setNewValid(e.target.value)} className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label>Notat</Label>
                <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} className="mt-1.5" />
              </div>
              <div className="flex justify-end">
                <Button onClick={addAuth} disabled={saving} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Legg til
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
